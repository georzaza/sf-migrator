/**
 * Transform Service — roadmap 5.2 (TRANSFORM / stage 2).
 *
 * Reads the raw extracted source data (stg1_* tables) and produces target-shaped
 * "stg2" tables, one per TARGET object, by applying the field mappings.
 *
 * Model (see /memories/session/plan-phase-E-pipeline.md "STG2 DESIGN"):
 *  - stg2 is per TARGET object. A single "driving" source object (the root of the
 *    field-reference paths, i.e. FieldMapping.sourceObjectId) defines the record
 *    grain: one driving source record -> one stg2 row.
 *  - Cross-object values are expressed via relationship traversal from the driving
 *    object, e.g. {Account.Contact.Comment}. Because stg1 tables are per-object and
 *    NOT joined, this service assembles a nested record per driving row by following
 *    relationships (relationshipName -> referenceTo) and reading the related stg1
 *    tables, then evaluates the expression against that nested record.
 *  - Lookup target fields keep the RAW SOURCE parent Id at this stage (an as-is copy).
 *    Remapping source Ids to target Ids happens later (stg3 / load), not here.
 *  - All stg2 columns are TEXT. Bookkeeping columns: __rowId (PK), __srcId, __srcObject,
 *    __status, __error, __runId, __transformedAt. History is kept across runs (no
 *    truncate); each run is tagged with __runId / __transformedAt.
 *
 * Out of scope here: stg3, the Salesforce load, src->tgt Id remapping, and the
 * mapping-time UI for resolving bare cross-object references.
 */

import { randomUUID, createHash } from 'crypto';

import db from '../../models/index.js';
import logger from '../lib/logger.js';
import metadataRepo from '../repositories/metadataRepository.js';
import mappingService from './mappingService.js';
import migrationSettingService from './migrationSettingService.js';
import extractionService from './extractionService.js';
import { parseTransformationRule, extractReferencedFields, evaluateTransformationRule } from '../utils/transformationRule.js';

const log = logger.create('transformService');

const INSERT_BATCH_SIZE = 500;

// Bookkeeping columns written on every stg2 row (besides __rowId / __transformedAt,
// which are managed by the table definition).
const META_INSERT_COLUMNS = ['__srcId', '__srcObject', '__status', '__error', '__runId'];

// In-memory status per org pair so a 202-style trigger can be polled without a schema change.
const transformStatusByKey = new Map();

function statusKey(sourceOrgId, targetOrgId) {
    return `${sourceOrgId}::${targetOrgId}`;
}

function getTransformStatus(sourceOrgId, targetOrgId) {
    return transformStatusByKey.get(statusKey(sourceOrgId, targetOrgId)) || { status: 'idle', progress: null, summary: null, error: null };
}

// Push a live progress snapshot (object-by-object) while a run is in flight, so the
// 202-style poller can show what is currently being transformed.
function setTransformProgress(sourceOrgId, targetOrgId, progress) {
    transformStatusByKey.set(statusKey(sourceOrgId, targetOrgId), {
        status: 'running',
        progress,
        summary: null,
        error: null,
    });
}

/**
 * Run the transform for every target object mapped between the two orgs.
 */
async function runTransform({ sourceOrgId, targetOrgId }) {
    if (!sourceOrgId || !targetOrgId) {
        throw new Error('sourceOrgId and targetOrgId are required');
    }

    const runId = randomUUID();
    log.info('Transform started', { runId, sourceOrgId, targetOrgId });

    const fieldMappings = await mappingService.getFieldMappingsByOrgPair(sourceOrgId, targetOrgId);
    const settingsMap = await migrationSettingService.getEffectiveSettingsMap(sourceOrgId, targetOrgId);

    // Group field mappings by target object; skip pairs marked disabled.
    const byTarget = new Map(); // targetObjectId -> { targetObject, mappings: [] }
    let skippedCount = 0;
    for (const fm of fieldMappings) {
        if (!fm.targetObject?.name || !fm.targetObjectId) continue;
        const setting = settingsMap.get(fm.sourceObjectId)?.get(fm.targetObjectId);
        if (setting && setting.enabled === false) {
            skippedCount += 1;
            continue;
        }
        if (!byTarget.has(fm.targetObjectId)) {
            byTarget.set(fm.targetObjectId, { targetObject: fm.targetObject, mappings: [] });
        }
        byTarget.get(fm.targetObjectId).mappings.push(fm);
    }
    if (skippedCount > 0) {
        log.info('Skipped disabled object pairs in transform', { skippedCount });
    }

    if (byTarget.size === 0) {
        log.warn('No field mappings found for org pair, nothing to transform', { runId, sourceOrgId, targetOrgId });
        return { runId, sourceOrgId, targetOrgId, targetObjectCount: 0, successCount: 0, failedCount: 0, results: [] };
    }

    const ctx = createContext(sourceOrgId);
    const results = [];

    const totalObjects = byTarget.size;
    let completed = 0;
    setTransformProgress(sourceOrgId, targetOrgId, { total: totalObjects, completed, currentObject: null, results: [...results] });

    for (const { targetObject, mappings } of byTarget.values()) {
        setTransformProgress(sourceOrgId, targetOrgId, { total: totalObjects, completed, currentObject: targetObject.name, results: [...results] });
        const result = await transformTargetObject({ runId, sourceOrgId, targetOrgId, targetObject, mappings, ctx });
        results.push(result);
        completed += 1;
        setTransformProgress(sourceOrgId, targetOrgId, { total: totalObjects, completed, currentObject: null, results: [...results] });
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.length - successCount;

    log.info('Transform completed', { runId, sourceOrgId, targetOrgId, targetObjectCount: results.length, successCount, failedCount });

    return { runId, sourceOrgId, targetOrgId, targetObjectCount: results.length, successCount, failedCount, results };
}

/**
 * Build the stg2 table for a single target object.
 */
async function transformTargetObject({ runId, sourceOrgId, targetOrgId, targetObject, mappings, ctx }) {
    const targetObjectName = targetObject.name;
    const startedAt = new Date();

    const base = {
        targetObject: targetObjectName,
        drivingObject: null,
        runId,
        stg2Table: null,
        rowCount: 0,
        successCount: 0,
        errorCount: 0,
        status: 'failed',
        errorMessage: null,
        startedAt,
        finishedAt: null,
    };

    try {
        // The driving (root) source object must be unique across the target's mappings.
        const distinctSourceIds = new Set(mappings.map(m => m.sourceObjectId).filter(Boolean));
        if (distinctSourceIds.size === 0) {
            throw new Error(`No source object resolved for target ${targetObjectName}`);
        }
        if (distinctSourceIds.size > 1) {
            const names = [...new Set(mappings.map(m => m.sourceObject?.name).filter(Boolean))];
            throw new Error(
                `Target ${targetObjectName} is fed by multiple source objects (${names.join(', ')}). ` +
                `Independent-root composition is not supported yet — express cross-object values as ` +
                `relationship paths from a single driving object.`,
            );
        }

        const drivingObject = mappings.find(m => m.sourceObject)?.sourceObject;
        const drivingObjectName = drivingObject?.name;
        if (!drivingObjectName) {
            throw new Error(`Driving source object metadata missing for target ${targetObjectName}`);
        }
        base.drivingObject = drivingObjectName;

        const drivingTable = extractionService.getStageTableName(sourceOrgId, drivingObjectName);
        if (!(await tableExists(drivingTable))) {
            throw new Error(`Source data not staged for driving object ${drivingObjectName} (missing table ${drivingTable}). Run extraction first.`);
        }

        // Target columns = one per mapped target field (deduped, sanitized API names).
        const targetColumns = [];
        const seenColumns = new Set();
        const columnByMapping = new Map(); // mapping -> sanitized column
        for (const m of mappings) {
            if (!m.targetField?.name) continue;
            const col = sanitizeColumnName(m.targetField.name);
            columnByMapping.set(m, col);
            if (!seenColumns.has(col)) {
                seenColumns.add(col);
                targetColumns.push(col);
            }
        }

        const stg2Table = getStg2TableName(targetOrgId, targetObjectName);
        base.stg2Table = stg2Table;
        await ensureStg2Table(stg2Table, targetColumns);

        // Collect relationship paths referenced by expression mappings, for nested-record assembly.
        const referencedPaths = new Set();
        for (const m of mappings) {
            if (m.mappingType === 'expression' && m.transformationRule) {
                const ast = parseTransformationRule(m.transformationRule);
                extractReferencedFields(ast, referencedPaths);
            }
        }

        const drivingRows = await readAllRows(drivingTable);
        log.info('Transforming target object', { runId, targetObjectName, drivingObjectName, rowCount: drivingRows.length });

        const outRows = [];
        let successCount = 0;
        let errorCount = 0;

        for (const drivingRow of drivingRows) {
            const errors = [];
            const record = await assembleRecord(ctx, drivingObjectName, drivingRow, referencedPaths);

            const values = {};
            for (const m of mappings) {
                const col = columnByMapping.get(m);
                if (!col) continue;
                try {
                    values[col] = computeFieldValue(m, drivingRow, record);
                } catch (error) {
                    values[col] = null;
                    errors.push(`${m.targetField.name}: ${error.message}`);
                }
            }

            const failed = errors.length > 0;
            if (failed) errorCount += 1; else successCount += 1;

            outRows.push({
                __srcId: getSourceId(drivingRow),
                __srcObject: drivingObjectName,
                __status: failed ? 'failed' : 'success',
                __error: failed ? errors.join('; ') : null,
                __runId: runId,
                values,
            });
        }

        await insertStg2Rows(stg2Table, targetColumns, outRows);

        base.rowCount = outRows.length;
        base.successCount = successCount;
        base.errorCount = errorCount;
        base.status = 'success';
        log.info('Target object transformed', { runId, targetObjectName, rowCount: base.rowCount, successCount, errorCount, stg2Table });
    } catch (error) {
        base.errorMessage = error.message || String(error);
        log.error('Target object transform failed', error, { runId, targetObjectName });
    }

    base.finishedAt = new Date();
    return base;
}

/**
 * Compute the stg2 value for a single field mapping.
 *  - as-is     -> the driving row's source field value (for lookups this is the source Id)
 *  - constant  -> the configured constant
 *  - expression-> evaluated against the assembled nested record
 */
function computeFieldValue(mapping, drivingRow, record) {
    const type = mapping.mappingType || 'as-is';

    if (type === 'as-is') {
        const sourceName = mapping.sourceField?.name;
        if (!sourceName) {
            throw new Error('as-is mapping has no source field');
        }
        const value = drivingRow[sourceName];
        return value === undefined || value === null ? null : String(value);
    }

    if (type === 'constant') {
        return mapping.constantValue === undefined || mapping.constantValue === null ? null : String(mapping.constantValue);
    }

    if (type === 'expression') {
        if (!mapping.transformationRule) {
            throw new Error('expression mapping has no transformation rule');
        }
        const result = evaluateTransformationRule(mapping.transformationRule, record);
        return result === undefined || result === null ? null : String(result);
    }

    throw new Error(`Unknown mapping type "${type}"`);
}

/**
 * Assemble a nested record for one driving row by following the relationship paths
 * referenced in the expressions, reading the related stg1 tables.
 *
 * Example: for path "Account.Contact.Comment" on an Account row, this attaches
 * record.Contact = <the related stg1_Contact row resolved via Account.ContactId>,
 * so the evaluator can read record.Contact.Comment.
 */
async function assembleRecord(ctx, drivingObjectName, drivingRow, referencedPaths) {
    const record = { ...drivingRow };

    for (const path of referencedPaths) {
        const segments = String(path).split('.');
        if (segments.length < 2) continue;
        // Only traverse paths rooted at the driving object; anything else is left unresolved.
        if (segments[0].toLowerCase() !== drivingObjectName.toLowerCase()) continue;

        let currentObjectName = drivingObjectName;
        let currentRow = drivingRow;
        let cursor = record;

        // Walk the intermediate relationship segments (everything between root and the leaf field).
        for (let i = 1; i < segments.length - 1; i += 1) {
            const relName = segments[i];
            const relationship = await getRelationship(ctx, currentObjectName, relName);
            if (!relationship || relationship.polymorphic) break;

            const sourceId = currentRow[relationship.idFieldName];
            if (!sourceId) break;

            const relatedRow = await getStg1RowById(ctx, relationship.targetObject, sourceId);
            if (!relatedRow) break;

            if (!cursor[relName] || typeof cursor[relName] !== 'object') {
                cursor[relName] = { ...relatedRow };
            }
            cursor = cursor[relName];
            currentObjectName = relationship.targetObject;
            currentRow = relatedRow;
        }
    }

    return record;
}

function getSourceId(row) {
    return row.Id ?? row.id ?? null;
}

/* ------------------------------------------------------------------ *
 * Per-run lookup context (relationship metadata + stg1 row indexes)
 * ------------------------------------------------------------------ */

function createContext(sourceOrgId) {
    return {
        sourceOrgId,
        objectsByName: null, // lazily loaded Map(lowercased name -> object row)
        fieldsByObjectId: new Map(), // objectId -> field rows
        relationshipCache: new Map(), // `${objName}:${relName}` -> { idFieldName, targetObject } | { polymorphic } | null
        stg1Index: new Map(), // lowercased objName -> Map(sourceId -> row)
        tableExistsCache: new Map(),
    };
}

async function getObjectsByName(ctx) {
    if (!ctx.objectsByName) {
        const objects = await metadataRepo.findObjectsByOrgId(ctx.sourceOrgId);
        ctx.objectsByName = new Map();
        for (const obj of objects) {
            ctx.objectsByName.set(obj.name.toLowerCase(), obj);
        }
    }
    return ctx.objectsByName;
}

async function getFieldsForObject(ctx, objectName) {
    const objects = await getObjectsByName(ctx);
    const obj = objects.get(objectName.toLowerCase());
    if (!obj) return [];
    if (!ctx.fieldsByObjectId.has(obj.id)) {
        ctx.fieldsByObjectId.set(obj.id, await metadataRepo.findFieldsByObjectId(obj.id));
    }
    return ctx.fieldsByObjectId.get(obj.id);
}

/**
 * Resolve a relationship segment on an object to its id field + referenced object.
 * Returns { idFieldName, targetObject }, { polymorphic: true }, or null if unknown.
 */
async function getRelationship(ctx, objectName, relationshipName) {
    const key = `${objectName.toLowerCase()}:${relationshipName.toLowerCase()}`;
    if (ctx.relationshipCache.has(key)) {
        return ctx.relationshipCache.get(key);
    }

    const fields = await getFieldsForObject(ctx, objectName);
    const field = fields.find(f => f.relationshipName && f.relationshipName.toLowerCase() === relationshipName.toLowerCase());

    let resolved = null;
    if (field) {
        const refs = Array.isArray(field.referenceTo) ? field.referenceTo : [];
        if (refs.length > 1) {
            resolved = { polymorphic: true };
        } else if (refs.length === 1) {
            resolved = { idFieldName: field.name, targetObject: refs[0] };
        }
    }

    ctx.relationshipCache.set(key, resolved);
    return resolved;
}

/**
 * Read (and cache) the stg1 rows for a related object, indexed by source Id.
 * NOTE (v1): loads the whole related stg1 table into memory. TODO: replace with a
 * SQL join / batched lookup for very large objects.
 */
async function getStg1RowById(ctx, objectName, sourceId) {
    const key = objectName.toLowerCase();
    if (!ctx.stg1Index.has(key)) {
        const index = new Map();
        const tableName = extractionService.getStageTableName(ctx.sourceOrgId, objectName);
        if (await tableExists(tableName, ctx)) {
            const rows = await readAllRows(tableName);
            for (const row of rows) {
                const id = getSourceId(row);
                if (id) index.set(String(id), row);
            }
        }
        ctx.stg1Index.set(key, index);
    }
    return ctx.stg1Index.get(key).get(String(sourceId)) || null;
}

/* ------------------------------------------------------------------ *
 * Dynamic stg2 table helpers
 * ------------------------------------------------------------------ */

async function ensureStg2Table(tableName, fieldColumns) {
    const quotedTable = quoteIdentifier(tableName);

    await db.sequelize.query(`
        CREATE TABLE IF NOT EXISTS ${quotedTable} (
            ${quoteIdentifier('__rowId')} BIGSERIAL PRIMARY KEY,
            ${quoteIdentifier('__srcId')} TEXT,
            ${quoteIdentifier('__srcObject')} TEXT,
            ${quoteIdentifier('__status')} TEXT,
            ${quoteIdentifier('__error')} TEXT,
            ${quoteIdentifier('__runId')} UUID,
            ${quoteIdentifier('__transformedAt')} TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    for (const col of fieldColumns) {
        await db.sequelize.query(`ALTER TABLE ${quotedTable} ADD COLUMN IF NOT EXISTS ${quoteIdentifier(col)} TEXT;`);
    }
}

async function insertStg2Rows(tableName, fieldColumns, rows) {
    if (rows.length === 0) return;

    const quotedTable = quoteIdentifier(tableName);
    const columns = [...META_INSERT_COLUMNS, ...fieldColumns];
    const quotedColumns = columns.map(quoteIdentifier).join(', ');

    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
        const values = [];
        const placeholders = [];
        let idx = 1;

        for (const row of batch) {
            const rowPlaceholders = [];
            for (const col of META_INSERT_COLUMNS) {
                values.push(row[col] ?? null);
                rowPlaceholders.push(`$${idx}`);
                idx += 1;
            }
            for (const col of fieldColumns) {
                values.push(row.values[col] ?? null);
                rowPlaceholders.push(`$${idx}`);
                idx += 1;
            }
            placeholders.push(`(${rowPlaceholders.join(', ')})`);
        }

        const sql = `INSERT INTO ${quotedTable} (${quotedColumns}) VALUES ${placeholders.join(', ')}`;
        await db.sequelize.query(sql, { bind: values });
    }
}

async function readAllRows(tableName) {
    const [rows] = await db.sequelize.query(`SELECT * FROM ${quoteIdentifier(tableName)};`);
    return rows;
}

async function tableExists(tableName, ctx = null) {
    if (ctx && ctx.tableExistsCache.has(tableName)) {
        return ctx.tableExistsCache.get(tableName);
    }
    // Exact, case-sensitive match: stg tables are created with quoted, case-preserved
    // names (e.g. "stg1_<uuid>_Account"), so to_regclass (which down-cases unquoted
    // identifiers) cannot be used here.
    const [rows] = await db.sequelize.query(
        `SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = $1
        ) AS exists;`,
        { bind: [tableName] },
    );
    const exists = !!rows?.[0]?.exists;
    if (ctx) ctx.tableExistsCache.set(tableName, exists);
    return exists;
}

/* ------------------------------------------------------------------ *
 * Naming / sanitization (mirrors extractionService conventions)
 * ------------------------------------------------------------------ */

function getStg2TableName(targetOrgId, targetObjectName) {
    const orgPart = String(targetOrgId).replace(/[^A-Za-z0-9_]/g, '_');
    const objectPart = String(targetObjectName).replace(/[^A-Za-z0-9_]/g, '_');

    const raw = `stg2_${orgPart}_${objectPart}`;
    if (raw.length <= 63) {
        return raw;
    }

    const hash = createHash('sha1').update(raw).digest('hex').slice(0, 8);
    const maxObjectPartLength = Math.max(1, 63 - (`stg2_${orgPart}_`.length + 9));
    const trimmedObjectPart = objectPart.slice(0, maxObjectPartLength);
    return `stg2_${orgPart}_${trimmedObjectPart}_${hash}`;
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
    runTransform,
    getTransformStatus,
    setTransformStatus: (sourceOrgId, targetOrgId, status) => {
        transformStatusByKey.set(statusKey(sourceOrgId, targetOrgId), status);
    },
    getStg2TableName,
};
