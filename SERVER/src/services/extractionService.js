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

const log = logger.create('extractionService');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INSERT_BATCH_SIZE = 500;

async function runExtraction({ sourceOrgId, targetOrgId = null }) {
    if (!sourceOrgId) {
        throw new Error('sourceOrgId is required');
    }

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

    const objectMappings = targetOrgId
        ? await mappingService.getObjectMappingsByOrgPair(sourceOrgId, targetOrgId)
        : await mappingService.getObjectMappingsBySourceOrg(sourceOrgId);

    const sourceObjects = await collectObjectsForExtraction(sourceOrgId, objectMappings);
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

    for (const sourceObject of sourceObjects) {
        const startedAt = new Date();
        const objectName = sourceObject.name;
        const sourceObjectId = sourceObject.id;
        const safeObjectFileName = sanitizeForFileName(objectName);

        log.info('Starting object extraction', { runId, sourceOrgId, objectName, sourceObjectId });

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

            // Identify compound parent fields (fields that are referenced by other fields' compoundFieldName)
            const compoundParentNames = new Set(
                objectFields
                    .map(f => f.compoundFieldName)
                    .filter(Boolean)
            );

            // Filter out compound parent fields (e.g., BillingAddress, MailingAddress)
            // Keep component fields (e.g., BillingStreet, BillingCity which reference the parent)
            const extractableFields = objectFields.filter(f => !compoundParentNames.has(f.name));
            fields = dedupeFieldNames(extractableFields.map(f => f.name));
            if (!fields.includes('Id')) {
                fields.unshift('Id');
            }
            log.info('Fields resolved for object', { objectName, fieldCount: fields.length });

            const soql = `SELECT ${fields.join(', ')} FROM ${objectName}`;
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
 * Collect all objects to extract following this logic:
 * 1. Start with all source objects from mappings
 * 2. For each object, get ALL its fields from the database
 * 3. Filter out compound parent fields (e.g., BillingAddress)
 * 4. Check each field - if it's a reference field, add referenced objects to extraction list
 * 5. Repeat process for newly added objects (transitive references)
 */
async function collectObjectsForExtraction(sourceOrgId, objectMappings) {
    log.info('Starting object collection for extraction', {
        sourceOrgId,
        objectMappingCount: objectMappings.length
    });

    const objectsToExtract = new Map(); // objectId -> {id, name, label}
    const processedObjectIds = new Set(); // Track which objects we've already scanned
    const objectsToProcess = []; // Queue of objects to scan for references

    // Step 1: Add all explicitly mapped source objects
    for (const mapping of objectMappings) {
        if (!mapping.sourceObjectId || !mapping.sourceObject?.name) continue;

        const sourceObject = {
            id: mapping.sourceObjectId,
            name: mapping.sourceObject.name,
            label: mapping.sourceObject.label || null,
        };

        objectsToExtract.set(sourceObject.id, sourceObject);
        objectsToProcess.push(sourceObject);
        log.info('Added explicitly mapped object', {
            objectName: sourceObject.name,
            objectId: sourceObject.id
        });
    }

    // Load ALL source org metadata once for lookups
    log.info('Loading source org metadata for reference resolution', { sourceOrgId });
    const allSourceOrgObjects = await metadataRepo.findObjectsByOrgId(sourceOrgId);
    const sourceOrgObjectsByName = new Map(
        allSourceOrgObjects.map(obj => [obj.name, {
            id: obj.id,
            name: obj.name,
            label: obj.label,
        }])
    );
    log.info('Source org metadata loaded', {
        sourceOrgId,
        totalObjectsInMetadata: allSourceOrgObjects.length
    });

    // Step 2-4: Process each object to find reference fields
    let referencedObjectsAdded = 0;

    while (objectsToProcess.length > 0) {
        const currentObject = objectsToProcess.shift();

        if (processedObjectIds.has(currentObject.id)) {
            continue; // Already processed this object
        }
        processedObjectIds.add(currentObject.id);

        log.info('Scanning object for reference fields', {
            objectName: currentObject.name,
            objectId: currentObject.id
        });

        // Step 2: Get ALL fields for this object
        const allFields = await metadataRepo.findFieldsByObjectId(currentObject.id);
        if (!allFields || allFields.length === 0) {
            log.warn('No fields found for object', { objectName: currentObject.name });
            continue;
        }

        // Step 3: Filter out compound parent fields
        const compoundParentNames = new Set(
            allFields
                .map(f => f.compoundFieldName)
                .filter(Boolean)
        );
        const extractableFields = allFields.filter(f => !compoundParentNames.has(f.name));

        log.info('Fields loaded for object', {
            objectName: currentObject.name,
            totalFields: allFields.length,
            extractableFields: extractableFields.length,
            compoundParentsFiltered: compoundParentNames.size
        });

        // Step 4: Check each field for references
        for (const field of extractableFields) {
            const isReferenceField = field.type === 'reference' ||
                                   field.type === 'lookup' ||
                                   field.type === 'masterdetail' ||
                                   (field.referenceTo && Array.isArray(field.referenceTo) && field.referenceTo.length > 0);

            if (!isReferenceField) continue;

            // Extract referenced object names
            const referencedObjectNames = extractTopReferenceTargetNames(field.referenceTo, 10);

            if (referencedObjectNames.length === 0) continue;

            log.info('Found reference field', {
                objectName: currentObject.name,
                fieldName: field.name,
                fieldType: field.type,
                referencedObjects: referencedObjectNames
            });

            // Add each referenced object to extraction list
            for (const refObjectName of referencedObjectNames) {
                const refObject = sourceOrgObjectsByName.get(refObjectName);

                if (!refObject) {
                    log.warn('Referenced object not found in source org metadata', {
                        referencedObjectName: refObjectName,
                        referencedBy: `${currentObject.name}.${field.name}`
                    });
                    continue;
                }

                if (objectsToExtract.has(refObject.id)) {
                    // Already in extraction list
                    continue;
                }

                // Add to extraction list and queue for processing
                objectsToExtract.set(refObject.id, refObject);
                objectsToProcess.push(refObject);
                referencedObjectsAdded++;

                log.info('✓ Added referenced object to extraction list', {
                    referencedObjectName: refObjectName,
                    objectId: refObject.id,
                    referencedBy: `${currentObject.name}.${field.name}`
                });
            }
        }
    }

    const finalObjects = Array.from(objectsToExtract.values()).filter(x => !!x.name);

    log.info('Object collection complete', {
        sourceOrgId,
        totalObjectsToExtract: finalObjects.length,
        explicitlyMapped: objectMappings.length,
        addedViaReferences: referencedObjectsAdded,
        allObjectsToExtract: finalObjects.map(o => o.name).sort()
    });

    return finalObjects;
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

function extractTopReferenceTargetNames(referenceTo, maxCount = 3) {
    if (!Array.isArray(referenceTo) || referenceTo.length === 0) return [];

    const names = [];
    for (const ref of referenceTo) {
        let name = null;
        if (typeof ref === 'string') {
            name = ref;
        } else if (ref && typeof ref === 'object') {
            name = ref.objectApiName || ref.name || ref.sobject || ref.targetObjectName || null;
        }

        if (!name || names.includes(name)) continue;
        names.push(name);
        if (names.length >= maxCount) break;
    }

    return names;
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

export default {
    runExtraction,
    runExtractionForTargetOrg,
};
