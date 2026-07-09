import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID, createHash } from 'crypto';

import jsforce from 'jsforce';
import db from '../../models/index.js';
import logger from '../lib/logger.js';
import orgRepo from '../repositories/orgRepository.js';
import metadataRepo from '../repositories/metadataRepository.js';
import mappingService from './mappingService.js';
import migrationSettingService from './migrationSettingService.js';
import { buildExtractionPlan } from './extractionPlanBuilder.js';

const log = logger.create('extractionService');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INSERT_BATCH_SIZE = 500;

// Tracks the object currently being extracted per source org (in-memory, for live UI feedback)
const extractionProgress = new Map(); // sourceOrgId -> currentObjectName | null

function getProgress(sourceOrgId) {
    const entry = extractionProgress.get(sourceOrgId);
    return entry ?? null;
}

async function runExtraction({ sourceOrgId, targetOrgId = null, sourceObjectIds = null }) {
    if (!sourceOrgId) {
        throw new Error('sourceOrgId is required');
    }
    const subset = Array.isArray(sourceObjectIds) && sourceObjectIds.length > 0
        ? new Set(sourceObjectIds.map(String))
        : null;

    const sourceOrg = await orgRepo.findById(sourceOrgId);
    if (!sourceOrg) {
        throw new Error(`Source org not found: ${sourceOrgId}`);
    }

    if (!sourceOrg.accessToken) {
        throw new Error(`No access token found for org ${sourceOrgId}. Please complete the org analysis first.`);
    }
    if (!sourceOrg.loginURL) {
        throw new Error('Source org loginURL is missing');
    }

    // Create connection with OAuth2 config for auto-refresh capability
    const oauth2 = new jsforce.OAuth2({
        loginUrl: sourceOrg.loginURL,
        clientId: sourceOrg.clientId,
        clientSecret: sourceOrg.clientSecret,
        redirectUri: process.env.SF_REDIRECT_URI,
    });

    const conn = new jsforce.Connection({
        oauth2,
        instanceUrl: sourceOrg.instanceUrl || sourceOrg.loginURL,
        accessToken: sourceOrg.accessToken,
        refreshToken: sourceOrg.refreshToken,
        version: '66.0'
    });

    // Refresh token if needed before starting extraction
    if (sourceOrg.refreshToken) {
        try {
            await conn.identity(); // This will auto-refresh if token is expired
            // Update tokens if they were refreshed
            if (conn.accessToken !== sourceOrg.accessToken) {
                await orgRepo.update(sourceOrgId, {
                    accessToken: conn.accessToken,
                    refreshToken: conn.refreshToken
                }).catch(err => log.warn('Failed to update refreshed tokens', err));
            }
        } catch (error) {
            log.error('Failed to verify/refresh connection', error, { sourceOrgId });
            throw new Error(`Authentication failed for org ${sourceOrgId}. Please re-authenticate the org.`);
        }
    }
    const runId = randomUUID();

    log.info('Extraction started', { runId, sourceOrgId, targetOrgId });

    const extractionDir = path.join(__dirname, '..', '..', 'data', sourceOrgId, 'Extraction');
    const soqlQueriesDir = path.join(extractionDir, 'SOQL_Queries');
    await fs.mkdir(soqlQueriesDir, { recursive: true });
    log.info('Extraction directories ensured', { extractionDir, soqlQueriesDir });

    const statsTableName = getExtractionStatsTableName(sourceOrgId);
    await ensureExtractionStatsTable(statsTableName);
    log.info('Extraction stats table ready', { statsTableName });

    const fieldMappings = targetOrgId
        ? await mappingService.getFieldMappingsByOrgPair(sourceOrgId, targetOrgId)
        : await mappingService.getFieldMappingsBySourceOrg(sourceOrgId);

    const extractionPlan = await buildExtractionPlan({
        sourceOrgId,
        fieldMappings,
        metadataRepo,
    });
    const sourceObjects = extractionPlan.objects;
    const requiredFieldsByObjectId = extractionPlan.fieldsByObjectId;

    // Per-pair settings — used to skip source objects whose every target pair is disabled.
    const settingsMap = targetOrgId
        ? await migrationSettingService.getEffectiveSettingsMap(sourceOrgId, targetOrgId)
        : new Map();
    const fullySkippedSourceObjectIds = computeFullySkippedSources(fieldMappings, settingsMap);

    log.info('Source objects resolved for extraction', {
        runId,
        sourceOrgId,
        targetOrgId,
        objectCount: sourceObjects.length,
        objects: sourceObjects.map(o => o.name),
    });

    if (sourceObjects.length === 0) {
        log.warn('No mapped source objects found, aborting extraction', { runId, sourceOrgId, targetOrgId });
        return {
            runId,
            sourceOrgId,
            targetOrgId,
            totalObjects: 0,
            successCount: 0,
            failedCount: 0,
            results: [],
            message: 'No mapped source objects found for extraction',
        };
    }

    const results = [];

    for (let i = 0; i < sourceObjects.length; i++) {
        const sourceObject = sourceObjects[i];
        const startedAt = new Date();
        const objectName = sourceObject.name;
        const sourceObjectId = sourceObject.id;
        const safeObjectFileName = sanitizeForFileName(objectName);
        extractionProgress.set(sourceOrgId, { objectName, remaining: sourceObjects.length - i - 1 });

        log.info('Starting object extraction', { runId, sourceOrgId, objectName, sourceObjectId });

        if (subset && !subset.has(String(sourceObjectId))) {
            log.info('Skipping source object — not in requested subset', { runId, objectName, sourceObjectId });
            extractionProgress.set(sourceOrgId, { objectName, remaining: sourceObjects.length - i - 1 });
            continue;
        }

        if (fullySkippedSourceObjectIds.has(sourceObjectId)) {
            log.info('Skipping source object — every target pair disabled', { runId, objectName, sourceObjectId });
            extractionProgress.set(sourceOrgId, { objectName, remaining: sourceObjects.length - i - 1 });
            results.push({
                sourceObjectId,
                objectName,
                status: 'skipped',
                fieldsExportedCount: 0,
                recordsExported: 0,
                startedAt,
                finishedAt: new Date(),
                queryFilePath: null,
                csvFilePath: null,
                stgTableName: null,
                validatedRowCount: null,
                errorMessage: 'All target pairs for this source object are disabled in Migration Settings.',
            });
            continue;
        }

        let fields = [];
        let queryFilePath = null;
        let csvFilePath = null;
        let recordsExported = 0;
        let status = 'failed';
        let errorMessage = null;
        let stgTableName = null;
        let validatedRowCount = null;

        try {
            const objectFields = await metadataRepo.findFieldsByObjectId(sourceObjectId);
            if (!objectFields || objectFields.length === 0) {
                throw new Error(`No fields found in metadata for source object ${objectName}`);
            }

            // Mapping-driven required fields for this object (always includes Id).
            const requestedSet = requiredFieldsByObjectId.get(sourceObjectId) || new Set(['Id']);

            // Field lookups and compound-parent detection for validation/substitution.
            const fieldsByName = new Map(objectFields.map(f => [f.name, f]));
            const compoundParentNames = new Set(
                objectFields.map(f => f.compoundFieldName).filter(Boolean)
            );
            const componentsByParent = new Map();
            for (const f of objectFields) {
                if (f.compoundFieldName) {
                    if (!componentsByParent.has(f.compoundFieldName)) {
                        componentsByParent.set(f.compoundFieldName, []);
                    }
                    componentsByParent.get(f.compoundFieldName).push(f.name);
                }
            }

            const resolved = [];
            for (const name of requestedSet) {
                if (!fieldsByName.has(name)) {
                    log.warn('Requested field not found in metadata; skipping', { objectName, fieldName: name });
                    continue;
                }
                if (compoundParentNames.has(name)) {
                    const components = componentsByParent.get(name) || [];
                    log.info('Substituting compound parent with components', { objectName, parent: name, components });
                    for (const c of components) resolved.push(c);
                    continue;
                }
                resolved.push(name);
            }

            fields = dedupeFieldNames(resolved);
            if (!fields.includes('Id')) {
                fields.unshift('Id');
            }
            log.info('Fields resolved for object', { objectName, fieldCount: fields.length, fields });

            const objectFilter = sanitizeRuntimeFilter(sourceObject.extractFilter);
            const soql = `SELECT ${fields.join(', ')} FROM ${objectName}${buildWhereSuffix(objectFilter)}`;
            console.log('Generated SOQL:', soql);
            queryFilePath = path.join(soqlQueriesDir, `${safeObjectFileName}.query`);
            await fs.writeFile(queryFilePath, soql, 'utf8');
            log.info('SOQL query file written', { queryFilePath });

            csvFilePath = path.join(extractionDir, `${safeObjectFileName}.csv`);
            log.info('Starting jsforce Bulk V2 export', { objectName, csvFilePath });

            await runBulk2Export({ conn, soql, outputCsvPath: csvFilePath });

            const { headers, rows } = await parseCsvFile(csvFilePath);
            log.info('CSV parsed', { objectName, csvFilePath, rowCount: rows.length, columnCount: headers.length });

            stgTableName = getStageTableName(sourceOrgId, objectName);
            log.info('Loading rows to staging table', { stgTableName, rowCount: rows.length });
            await loadRowsToDynamicTable(stgTableName, headers, rows);

            validatedRowCount = await validateLoadedTable(stgTableName, rows.length);
            log.info('Staging table validated', { stgTableName, validatedRowCount });

            recordsExported = rows.length;
            status = 'success';
            log.info('Object extraction succeeded', { runId, objectName, recordsExported, stgTableName });
        } catch (error) {
            errorMessage = error.message || String(error);
            log.error('Object extraction failed', error, {
                sourceOrgId,
                objectName,
            });
        }

        const finishedAt = new Date();

        log.info('Writing extraction stat', { runId, objectName, status, recordsExported, stgTableName, durationMs: new Date() - startedAt });
        await insertExtractionStat(statsTableName, {
            runId,
            sourceObjectId,
            objectName,
            fieldsExported: fields,
            status,
            startedAt,
            finishedAt,
            recordsExported,
            queryFilePath,
            csvFilePath,
            stgTableName,
            validatedRowCount,
            errorMessage,
        });

        results.push({
            sourceObjectId,
            objectName,
            status,
            fieldsExportedCount: fields.length,
            recordsExported,
            startedAt,
            finishedAt,
            queryFilePath,
            csvFilePath,
            stgTableName,
            validatedRowCount,
            errorMessage,
        });
    }

    const successCount = results.filter(x => x.status === 'success').length;
    const failedCount = results.length - successCount;

    extractionProgress.delete(sourceOrgId);
    log.info('Extraction completed', { runId, sourceOrgId, targetOrgId, totalObjects: results.length, successCount, failedCount });

    return {
        runId,
        sourceOrgId,
        targetOrgId,
        totalObjects: results.length,
        successCount,
        failedCount,
        results,
        todos: [
            'TODO: Add wide-object split and merge fallback when full-field SOQL export fails.',
            'TODO: Split fields into multiple query files and merge by Id before dynamic DB load.',
        ],
    };
}

async function runExtractionForTargetOrg({ targetOrgId }) {
    if (!targetOrgId) {
        throw new Error('targetOrgId is required');
    }

    log.info('Target-org extraction started', { targetOrgId });

    const targetOrg = await orgRepo.findById(targetOrgId);
    if (!targetOrg) {
        throw new Error(`Target org not found: ${targetOrgId}`);
    }

    const objectMappings = await mappingService.getObjectMappingsByTargetOrg(targetOrgId);
    if (!objectMappings.length) {
        log.warn('No source-to-target mappings found, aborting target-org extraction', { targetOrgId });
        return {
            targetOrgId,
            sourceOrgIds: [],
            totalSourceOrgs: 0,
            totalObjects: 0,
            successCount: 0,
            failedCount: 0,
            resultsBySourceOrg: [],
            createdStageTables: [],
            message: 'No source-to-target mappings found for this target org',
        };
    }

    const sourceOrgIds = Array.from(new Set(
        objectMappings
            .map(m => m.sourceObject?.sfOrgId)
            .filter(Boolean)
    ));

    log.info('Source orgs identified for target-org extraction', { targetOrgId, sourceOrgIds, sourceOrgCount: sourceOrgIds.length });

    const resultsBySourceOrg = [];
    const createdStageTables = [];
    let totalObjects = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const sourceOrgId of sourceOrgIds) {
        log.info('Running extraction for source org', { targetOrgId, sourceOrgId });
        try {
            const sourceSummary = await runExtraction({ sourceOrgId, targetOrgId });
            totalObjects += sourceSummary.totalObjects || 0;
            successCount += sourceSummary.successCount || 0;
            failedCount += sourceSummary.failedCount || 0;

            for (const item of sourceSummary.results || []) {
                if (item.stgTableName) {
                    createdStageTables.push(item.stgTableName);
                }
            }

            log.info('Source org extraction succeeded', { targetOrgId, sourceOrgId, objects: sourceSummary.totalObjects, success: sourceSummary.successCount, failed: sourceSummary.failedCount });
            resultsBySourceOrg.push({
                sourceOrgId,
                status: 'success',
                summary: sourceSummary,
            });
        } catch (error) {
            log.error('Source org extraction failed', error, { targetOrgId, sourceOrgId });
            resultsBySourceOrg.push({
                sourceOrgId,
                status: 'failed',
                errorMessage: error.message || String(error),
            });
            failedCount += 1;
        }
    }

    const uniqueStageTables = Array.from(new Set(createdStageTables));

    log.info('Target-org extraction completed', { targetOrgId, totalSourceOrgs: sourceOrgIds.length, totalObjects, successCount, failedCount, createdStageTables: uniqueStageTables });

    return {
        targetOrgId,
        sourceOrgIds,
        totalSourceOrgs: sourceOrgIds.length,
        totalObjects,
        successCount,
        failedCount,
        createdStageTables: uniqueStageTables,
        resultsBySourceOrg,
    };
}

/**
 * Walk all (source -> target) mappings and return the set of source object ids
 * whose every target pairing is explicitly disabled in MigrationSettings.
 */
function computeFullySkippedSources(fieldMappings, settingsMap) {
    const seenTargetsBySource = new Map(); // sourceObjectId -> Set<targetObjectId>
    for (const m of fieldMappings) {
        if (!m.sourceObjectId || !m.targetObjectId) continue;
        if (!seenTargetsBySource.has(m.sourceObjectId)) seenTargetsBySource.set(m.sourceObjectId, new Set());
        seenTargetsBySource.get(m.sourceObjectId).add(m.targetObjectId);
    }
    const fullySkipped = new Set();
    for (const [sourceId, targets] of seenTargetsBySource) {
        const targetSettings = settingsMap.get(sourceId);
        if (!targetSettings) continue;
        const everyDisabled = [...targets].every((tid) => targetSettings.get(tid)?.enabled === false);
        if (everyDisabled) fullySkipped.add(sourceId);
    }
    return fullySkipped;
}

/** Last-line defense before interpolating user-provided SOQL into the WHERE clause. */
function sanitizeRuntimeFilter(raw) {
    if (raw === null || raw === undefined) return null;
    const text = String(raw).trim();
    if (!text) return null;
    if (text.includes(';')) return null;
    return text;
}

function buildWhereSuffix(whereClause) {
    if (!whereClause) return '';
    return ` WHERE ${whereClause}`;
}

function dedupeFieldNames(fieldNames) {
    const unique = [];
    const seen = new Set();

    for (const fieldName of fieldNames) {
        if (!fieldName || seen.has(fieldName)) continue;
        seen.add(fieldName);
        unique.push(fieldName);
    }

    return unique;
}

async function runBulk2Export({ conn, soql, outputCsvPath }) {
    log.info('jsforce Bulk V2: starting query stream', { outputCsvPath });
    const recordStream = await conn.bulk2.query(soql);
    await new Promise((resolve, reject) => {
        const writeStream = createWriteStream(outputCsvPath);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        recordStream.stream().pipe(writeStream);
        recordStream.on('error', reject);
    });
}

async function parseCsvFile(csvPath) {
    const content = await fs.readFile(csvPath, 'utf8');
    const rows = parseCsv(content);

    if (rows.length === 0) {
        throw new Error(`CSV file has no rows: ${csvPath}`);
    }

    const headers = rows[0].map((h, i) => {
        const clean = i === 0 ? String(h || '').replace(/^\uFEFF/, '') : String(h || '');
        return clean;
    });

    const dataRows = rows.slice(1).filter(row => row.some(cell => cell !== null && String(cell).trim() !== ''));

    const normalizedRows = dataRows.map(row => {
        const normalized = [];
        for (let i = 0; i < headers.length; i += 1) {
            normalized.push(row[i] !== undefined ? row[i] : null);
        }
        return normalized;
    });

    return { headers, rows: normalizedRows };
}

function parseCsv(input) {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;

    for (let i = 0; i < input.length; i += 1) {
        const ch = input[i];
        const next = input[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') {
                value += '"';
                i += 1;
                continue;
            }
            if (ch === '"') {
                inQuotes = false;
                continue;
            }
            value += ch;
            continue;
        }

        if (ch === '"') {
            inQuotes = true;
            continue;
        }

        if (ch === ',') {
            row.push(value);
            value = '';
            continue;
        }

        if (ch === '\n') {
            row.push(value);
            rows.push(row);
            row = [];
            value = '';
            continue;
        }

        if (ch === '\r') {
            continue;
        }

        value += ch;
    }

    if (value.length > 0 || row.length > 0) {
        row.push(value);
        rows.push(row);
    }

    return rows;
}

async function loadRowsToDynamicTable(tableName, headers, rows) {
    if (!headers || headers.length === 0) {
        throw new Error('No headers found for dynamic table load');
    }

    const columns = headers.map(sanitizeColumnName);

    await ensureDynamicTable(tableName, columns);
    await truncateTable(tableName);

    if (rows.length === 0) {
        return;
    }

    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
        await insertRows(tableName, columns, batch);
    }
}

async function ensureDynamicTable(tableName, columns) {
    const quotedTableName = quoteIdentifier(tableName);
    const quotedColumns = columns.map(c => `${quoteIdentifier(c)} TEXT`).join(', ');

    log.info('DB: ensuring staging table exists', { tableName, columnCount: columns.length });
    await db.sequelize.query(`CREATE TABLE IF NOT EXISTS ${quotedTableName} (${quotedColumns});`);

    for (const col of columns) {
        await db.sequelize.query(`ALTER TABLE ${quotedTableName} ADD COLUMN IF NOT EXISTS ${quoteIdentifier(col)} TEXT;`);
    }
}

async function truncateTable(tableName) {
    const quotedTableName = quoteIdentifier(tableName);
    log.info('DB: truncating staging table', { tableName });
    await db.sequelize.query(`TRUNCATE TABLE ${quotedTableName};`);
}

async function insertRows(tableName, columns, rows) {
    const quotedTableName = quoteIdentifier(tableName);
    const quotedColumns = columns.map(quoteIdentifier).join(', ');

    const values = [];
    const placeholders = [];

    let idx = 1;
    for (const row of rows) {
        const rowPlaceholders = [];
        for (let i = 0; i < columns.length; i += 1) {
            values.push(row[i] ?? null);
            rowPlaceholders.push(`$${idx}`);
            idx += 1;
        }
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const sql = `INSERT INTO ${quotedTableName} (${quotedColumns}) VALUES ${placeholders.join(', ')}`;
    await db.sequelize.query(sql, { bind: values });
}

async function validateLoadedTable(tableName, expectedRows) {
    const quotedTableName = quoteIdentifier(tableName);
    log.info('DB: validating staging table row count', { tableName, expectedRows });
    const [rows] = await db.sequelize.query(`SELECT COUNT(*)::int AS count FROM ${quotedTableName};`);
    const count = rows?.[0]?.count ?? 0;

    if (count !== expectedRows) {
        log.error('DB: staging table row-count mismatch', new Error(`Row count mismatch`), { tableName, expectedRows, actualCount: count });
        throw new Error(`Staging table row-count mismatch for ${tableName}: expected ${expectedRows}, got ${count}`);
    }

    return count;
}

async function ensureExtractionStatsTable(tableName) {
    log.info('DB: ensuring extraction stats table', { tableName });
    const quotedTable = quoteIdentifier(tableName);

    await db.sequelize.query(`
        CREATE TABLE IF NOT EXISTS ${quotedTable} (
            id BIGSERIAL PRIMARY KEY,
            runId UUID NOT NULL,
            sourceObjectId UUID,
            objectName TEXT NOT NULL,
            fieldsExported JSONB,
            status TEXT NOT NULL,
            startedAt TIMESTAMPTZ NOT NULL,
            finishedAt TIMESTAMPTZ NOT NULL,
            recordsExported INTEGER NOT NULL DEFAULT 0,
            queryFilePath TEXT,
            csvFilePath TEXT,
            stg1TableName TEXT,
            errorMessage TEXT,
            createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);
}

async function insertExtractionStat(tableName, row) {
    log.info('DB: inserting extraction stat', { tableName, runId: row.runId, objectName: row.objectName, status: row.status });
    const quotedTable = quoteIdentifier(tableName);

    await db.sequelize.query(`
        INSERT INTO ${quotedTable}
        (runId, sourceObjectId, objectName, fieldsExported, status, startedAt, finishedAt, recordsExported, queryFilePath, csvFilePath, stg1TableName, errorMessage)
        VALUES
        ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12);
    `, {
        bind: [
            row.runId,
            row.sourceObjectId,
            row.objectName,
            JSON.stringify(row.fieldsExported || []),
            row.status,
            row.startedAt,
            row.finishedAt,
            row.recordsExported,
            row.queryFilePath,
            row.csvFilePath,
            row.stgTableName,
            row.errorMessage,
        ],
    });
}

function getExtractionStatsTableName(sourceOrgId) {
    const orgPart = sourceOrgId.replace(/[^A-Za-z0-9_]/g, '_');
    return `ext_${orgPart}_extraction_stats`;
}

function getStageTableName(sourceOrgId, objectApiName) {
    const orgPart = sourceOrgId.replace(/[^A-Za-z0-9_]/g, '_');
    const objectPart = objectApiName.replace(/[^A-Za-z0-9_]/g, '_');

    const raw = `stg1_${orgPart}_${objectPart}`;
    if (raw.length <= 63) {
        return raw;
    }

    const hash = createHash('sha1').update(raw).digest('hex').slice(0, 8);
    const maxObjectPartLength = Math.max(1, 63 - (`stg1_${orgPart}_`.length + 9));
    const trimmedObjectPart = objectPart.slice(0, maxObjectPartLength);
    return `stg1_${orgPart}_${trimmedObjectPart}_${hash}`;
}

function sanitizeForFileName(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_');
}

function sanitizeColumnName(name) {
    return String(name || '')
        .trim()
        .replace(/^\uFEFF/, '')
        .replace(/[^A-Za-z0-9_]/g, '_') || 'col';
}

function quoteIdentifier(identifier) {
    return `"${String(identifier).replace(/"/g, '""')}"`;
}

/**
 * Returns the list of source objects that would be extracted for an org pair,
 * each annotated with its `extractFilter`, whether it was directly mapped by
 * the user, and whether all of its target pairings are disabled.
 */
async function getExtractionPreview({ sourceOrgId, targetOrgId = null }) {
    if (!sourceOrgId) throw new Error('sourceOrgId is required');

    const fieldMappings = targetOrgId
        ? await mappingService.getFieldMappingsByOrgPair(sourceOrgId, targetOrgId)
        : await mappingService.getFieldMappingsBySourceOrg(sourceOrgId);

    const plan = await buildExtractionPlan({ sourceOrgId, fieldMappings, metadataRepo });

    const directlyMapped = new Set(
        fieldMappings.map(m => m.sourceObjectId).filter(Boolean).map(String),
    );

    const settingsMap = targetOrgId
        ? await migrationSettingService.getEffectiveSettingsMap(sourceOrgId, targetOrgId)
        : new Map();
    const skipped = computeFullySkippedSources(fieldMappings, settingsMap);

    const objects = plan.objects.map((obj) => ({
        id: obj.id,
        name: obj.name,
        label: obj.label || obj.name,
        extractFilter: obj.extractFilter ?? null,
        isIntermediate: !directlyMapped.has(String(obj.id)),
        isDisabled: skipped.has(obj.id),
        fields: Array.from(plan.fieldsByObjectId.get(obj.id) || []).sort(),
    }));

    return {
        sourceOrgId,
        targetOrgId,
        objects,
    };
}

export default {
    runExtraction,
    runExtractionForTargetOrg,
    getExtractionPreview,
    getStageTableName,
    getProgress,
};
