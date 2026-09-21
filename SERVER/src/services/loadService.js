/**
 * Load Service
 *
 * Builds the insert-ready "stg3" tables from the transformed stg2 data and loads
 * them into the target org via Bulk API 2.0, in dependency order.
 *
 * Model:
 *  - Objects load parents-first using dependencyService.getLoadPlan. Cyclic /
 *    self-referential lookups are cut ("deferredFields") and filled in a 2nd pass.
 *  - stg3 is built per target object from the LATEST stg2 run, success rows only.
 *    One stg2 row -> one stg3 row. Lookup columns are remapped from the SOURCE
 *    parent Id to the TARGET parent Id by reading RecordIdMap (populated as
 *    parents finish their pass-1 load).
 *  - LOAD OPERATION is driven by the per-object operation + External ID config:
 *      * operation='insert': Standard INSERT (no External ID required)
 *      * operation='upsert': Salesforce UPSERT with External ID field
 *        (user must select an External ID field and map it)
 *  - Salesforce handles record matching for upsert automatically via the
 *    External ID field, updating existing records or creating new ones.
 *  - Cascade: if a parent record was not loaded, the child row is NOT loaded.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID, createHash } from 'crypto';

import db from '../../models/index.js';
import logger from '../lib/logger.js';
import dependencyService from './dependencyService.js';
import mappingService from './mappingService.js';
import transformService from './transformService.js';
import tracebackService from './tracebackService.js';
import bulkIngestService from './bulkIngestService.js';
import recordIdMapRepository from '../repositories/recordIdMapRepository.js';

const log = logger.create('loadService');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INSERT_BATCH_SIZE = 500;

// stg2/stg3 bookkeeping columns (everything else on an stg2 row is a field column).
const STG2_META_COLUMNS = new Set(['__rowId', '__srcId', '__srcObject', '__status', '__error', '__runId', '__transformedAt']);
const STG3_META_INSERT_COLUMNS = ['__srcId', '__srcObject', '__status', '__error', '__targetId', '__runId'];

// In-memory status per org pair (polled via a 202-style trigger; resets on restart).
const loadStatusByKey = new Map();

function statusKey(sourceOrgId, targetOrgId) {
    return `${sourceOrgId}::${targetOrgId}`;
}

function getLoadStatus(sourceOrgId, targetOrgId) {
    return loadStatusByKey.get(statusKey(sourceOrgId, targetOrgId)) || { status: 'idle', progress: null, summary: null, error: null };
}

function setLoadStatus(sourceOrgId, targetOrgId, status) {
    loadStatusByKey.set(statusKey(sourceOrgId, targetOrgId), status);
}

// Push a live progress snapshot (object-by-object, per pass) while a load is in
// flight, so the 202-style poller can show what is currently being loaded.
function setLoadProgress(sourceOrgId, targetOrgId, progress) {
    loadStatusByKey.set(statusKey(sourceOrgId, targetOrgId), {
        status: 'running',
        progress,
        summary: null,
        error: null,
    });
}

/**
 * Run the full load (stg3 build + Bulk insert + deferred 2nd pass) for an org pair.
 */
async function runLoad({ sourceOrgId, targetOrgId }) {
    if (!sourceOrgId || !targetOrgId) {
        throw new Error('sourceOrgId and targetOrgId are required');
    }

    const runId = randomUUID();
    log.info('Load started', { runId, sourceOrgId, targetOrgId });

    const { loadOrder, deferredFields } = await dependencyService.getLoadPlan(sourceOrgId, targetOrgId);
    if (loadOrder.length === 0) {
        log.warn('Load plan is empty, nothing to load', { runId, sourceOrgId, targetOrgId });
        return { runId, sourceOrgId, targetOrgId, objectCount: 0, results: [] };
    }

    // Field mappings grouped by target object.
    const fieldMappings = await mappingService.getFieldMappingsByOrgPair(sourceOrgId, targetOrgId);
    const mappingsByTarget = new Map();
    for (const fm of fieldMappings) {
        if (!fm.targetObjectId) continue;
        if (!mappingsByTarget.has(fm.targetObjectId)) mappingsByTarget.set(fm.targetObjectId, []);
        mappingsByTarget.get(fm.targetObjectId).push(fm);
    }

    const loadDir = path.join(__dirname, '..', '..', 'data', targetOrgId, 'Load', runId);
    await fs.mkdir(loadDir, { recursive: true });

    const conn = await bulkIngestService.buildConnection(targetOrgId);

    const ctx = {
        runId,
        sourceOrgId,
        targetOrgId,
        conn,
        loadDir,
        idMaps: new Map(), // source object name -> Map(sourceId -> targetId)
    };

    const results = [];
    const totalObjects = loadOrder.length;
    let completed = 0;
    setLoadProgress(sourceOrgId, targetOrgId, { pass: 1, total: totalObjects, completed, currentObject: null, results: [...results] });

    // PASS 1 — insert/upsert each object in dependency order.
    try {
        for (const node of loadOrder) {
            setLoadProgress(sourceOrgId, targetOrgId, { pass: 1, total: totalObjects, completed, currentObject: node.targetObjectName, results: [...results] });
            const mappings = mappingsByTarget.get(node.targetObjectId) || [];
            const deferredForObject = deferredFields.filter((d) => d.sourceObjectId === node.sourceObjectId);
            const result = await loadObjectPass1({ ctx, node, mappings, deferredForObject });
            results.push(result);
            completed += 1;
            setLoadProgress(sourceOrgId, targetOrgId, { pass: 1, total: totalObjects, completed, currentObject: null, results: [...results] });
        }
    } catch (error) {
        log.error('Load aborted', error, { runId, sourceOrgId, targetOrgId });
        const summary = {
            runId, sourceOrgId, targetOrgId,
            objectCount: results.length, loadDir, results,
            aborted: true, error: error.message,
        };
        return summary;
    }

    // PASS 2 — fill the deferred (cut/self-ref) lookups now that all target Ids exist.
    const deferredNodes = loadOrder.filter((node) => deferredFields.some((d) => d.sourceObjectId === node.sourceObjectId));
    let deferredCompleted = 0;
    for (const node of deferredNodes) {
        const deferredForObject = deferredFields.filter((d) => d.sourceObjectId === node.sourceObjectId);
        const mappings = mappingsByTarget.get(node.targetObjectId) || [];
        const result = results.find((r) => r.targetObject === node.targetObjectName);
        if (!result || result.status === 'skipped') { deferredCompleted += 1; continue; }
        setLoadProgress(sourceOrgId, targetOrgId, { pass: 2, total: deferredNodes.length, completed: deferredCompleted, currentObject: node.targetObjectName, results: [...results] });
        await loadObjectPass2({ ctx, node, mappings, deferredForObject, result });
        deferredCompleted += 1;
        setLoadProgress(sourceOrgId, targetOrgId, { pass: 2, total: deferredNodes.length, completed: deferredCompleted, currentObject: null, results: [...results] });
    }

    const summary = {
        runId,
        sourceOrgId,
        targetOrgId,
        objectCount: results.length,
        loadDir,
        results,
    };
    log.info('Load completed', { runId, sourceOrgId, targetOrgId, objectCount: results.length });
    return summary;
}

/**
 * Build stg3 for one object, run upsert or insert operation, and store the
 * target IDs for child object lookups (pass 1).
 */
async function loadObjectPass1({ ctx, node, mappings, deferredForObject }) {
    const { sourceObjectName, targetObjectName, sourceObjectId, targetObjectId } = node;

    const result = {
        targetObject: targetObjectName,
        sourceObject: sourceObjectName,
        status: 'failed',
        stg3Table: null,
        total: 0,
        ready: 0,
        loaded: 0,
        failed: 0,
        skipped: 0,
        deferredUpdated: 0,
        errorMessage: null,
        successCsv: null,
        errorCsv: null,
    };

    try {
        // Get operation and upsert External ID configuration
        const upsertConfig = await tracebackService.getUpsertConfig(sourceObjectId, targetObjectId);
        const operation = upsertConfig.operation || 'upsert';
        const upsertExternalId = upsertConfig.upsertExternalId;

        // Validate configuration
        if (operation === 'upsert') {
            if (!upsertExternalId) {
                result.status = 'skipped';
                result.errorMessage = 'Operation is UPSERT but no External ID is configured; object not migrated.';
                log.warn('Object skipped: UPSERT requires External ID', { targetObjectName });
                return result;
            }
            // Check if External ID is mapped
            const isMapped = await tracebackService.isUpsertExternalIdMapped(
                sourceObjectId,
                targetObjectId,
                upsertExternalId.name,
            );
            if (!isMapped) {
                result.status = 'skipped';
                result.errorMessage = `External ID field "${upsertExternalId.name}" is not mapped; object not migrated.`;
                log.warn('Object skipped: External ID not mapped', { targetObjectName, externalIdField: upsertExternalId.name });
                return result;
            }
        }

        // Build target field columns from mappings
        const targetColumns = [];
        const seen = new Set();
        const lookupRemap = new Map();    // targetColumn -> parent SOURCE object name
        const deferredColumns = new Map(); // targetColumn -> parent SOURCE object name

        for (const m of mappings) {
            if (!m.targetField?.name) continue;
            const col = sanitizeColumnName(m.targetField.name);
            if (!seen.has(col)) { seen.add(col); targetColumns.push(col); }

            if (m.mappingType === 'as-is' && Array.isArray(m.sourceField?.referenceTo) && m.sourceField.referenceTo.length > 0) {
                const referencedObjectName = getFirstReferenceTargetName(m.sourceField.referenceTo);
                if (referencedObjectName) lookupRemap.set(col, referencedObjectName);
            }
        }

        for (const d of deferredForObject) {
            const m = mappings.find((mm) => mm.sourceField?.name === d.fieldName);
            if (!m?.targetField?.name) continue;
            deferredColumns.set(sanitizeColumnName(m.targetField.name), d.referencedObjectName);
        }

        // Read the latest successful stg2 run
        const stg2Table = transformService.getStg2TableName(ctx.targetOrgId, targetObjectName);
        if (!(await tableExists(stg2Table))) {
            throw new Error(`Transformed data not staged for ${targetObjectName} (missing table ${stg2Table}). Run the transform first.`);
        }
        const runId = await getLatestRunId(stg2Table);
        if (!runId) {
            result.status = 'success';
            log.info('No stg2 rows to load', { targetObjectName });
            return result;
        }
        const stg2Rows = await readSuccessRows(stg2Table, runId);
        result.total = stg2Rows.length;

        // Preload parent target IDs (lookup remap) from the RecordIdMap cache
        const lookupSourceIdsByParent = collectLookupSourceIds(stg2Rows, targetColumns, lookupRemap);
        for (const [parent, sourceIds] of lookupSourceIdsByParent) {
            await getIdMap(ctx, parent, sourceIds);
        }

        // Create stg3 table
        const stg3Table = getStg3TableName(ctx.targetOrgId, targetObjectName);
        result.stg3Table = stg3Table;
        await ensureStg3Table(stg3Table, targetColumns);

        const stg3Rows = [];
        const readyRecords = []; // records ready for Bulk API

        // Build records for Bulk API
        for (const row of stg2Rows) {
            const srcId = row.__srcId;
            const values = {};
            let rowError = null;

            /* previous code with error
            for (const col of targetColumns) {
                const raw = row[col];

                // Handle lookup fields (remap source parent ID to target parent ID)
                if (lookupRemap.has(col) && raw !== null && raw !== undefined && String(raw) !== '') {
                    const parentObj = lookupRemap.get(col);
                    const parentMap = await getIdMap(ctx, parentObj, [raw]);
                    const targetParentId = parentMap.get(String(raw));
                    if (targetParentId) {
                        values[col] = targetParentId;
                    } else {
                        rowError = `Lookup ${col}: parent ${parentObj} record ${raw} was not loaded`;
                        break;
                    }
                }
                // Handle deferred fields (set to null, will be filled in pass 2)
                else if (deferredColumns.has(col)) {
                    values[col] = null;
                }
                // Handle regular mapped fields
                else {
                    values[col] = raw ?? null;
                }
            }
            */
           for (const col of targetColumns) {
                const raw = row[col];

                // Handle deferred fields FIRST.
                // These lookups intentionally remain null in pass 1
                // and are populated during pass 2.
                if (deferredColumns.has(col)) {
                    values[col] = null;
                }
                // Handle normal lookup fields.
                else if (lookupRemap.has(col) && raw !== null && raw !== undefined && String(raw) !== '') {
                    const parentObj = lookupRemap.get(col);
                    const parentMap = await getIdMap(ctx, parentObj, [raw]);
                    const targetParentId = parentMap.get(String(raw));

                    if (targetParentId) {
                        values[col] = targetParentId;
                    } else {
                        rowError = `Lookup ${col}: parent ${parentObj} record ${raw} was not loaded`;
                        break;
                    }
                }
                // Handle regular mapped fields.
                else {
                    values[col] = raw ?? null;
                }
            }

            if (rowError) {
                stg3Rows.push(makeStg3Row(srcId, sourceObjectName, 'skipped', rowError, null, ctx.runId, values));
                result.skipped += 1;
                continue;
            }

            readyRecords.push({ srcId, values });
            result.ready += 1;
        }

        // Execute Bulk API operation (INSERT or UPSERT)
        let bulkResults = { successfulResults: [], failedResults: [], unprocessedRecords: [] };
        if (readyRecords.length > 0) {
            const bulkOp = operation === 'upsert' ? 'upsert' : 'insert';
            bulkResults = await bulkIngestService.ingestRecords({
                conn: ctx.conn,
                objectName: targetObjectName,
                operation: bulkOp,
                externalIdFieldName: operation === 'upsert' ? upsertExternalId.name : undefined,
                records: readyRecords.map((r) => r.values),
            });
        }

        // Process Bulk API results
        // For UPSERT: Salesforce matches records by External ID automatically
        // For INSERT: All records are created as new
        const successBySrcId = new Map();
        const failedBySrcId = new Map();
        const unprocessedSet = new Set();

        // Match results back to source records using the External ID field (for upsert) or record order
        if (operation === 'upsert' && upsertExternalId) {
            const externalIdCol = sanitizeColumnName(upsertExternalId.name);

            // Build a lookup map: externalIdValue -> srcId
            const externalIdToSrcId = new Map();
            for (const rec of readyRecords) {
                const extIdValue = rec.values[externalIdCol];
                if (extIdValue != null) {
                    externalIdToSrcId.set(String(extIdValue), rec.srcId);
                }
            }

            for (const s of bulkResults.successfulResults) {
                const extIdValue = s[externalIdCol];
                if (extIdValue != null) {
                    const srcId = externalIdToSrcId.get(String(extIdValue));
                    if (srcId && s.sf__Id) {
                        successBySrcId.set(String(srcId), s.sf__Id);
                    }
                }
            }

            for (const f of bulkResults.failedResults) {
                const extIdValue = f[externalIdCol];
                if (extIdValue != null) {
                    const srcId = externalIdToSrcId.get(String(extIdValue));
                    if (srcId) {
                        failedBySrcId.set(String(srcId), f.sf__Error || 'Unknown error');
                    }
                }
            }

            const unprocessed = Array.isArray(bulkResults.unprocessedRecords) ? bulkResults.unprocessedRecords : [];
            for (const u of unprocessed) {
                const extIdValue = u?.[externalIdCol];
                if (extIdValue != null) {
                    const srcId = externalIdToSrcId.get(String(extIdValue));
                    if (srcId) unprocessedSet.add(String(srcId));
                }
            }
        } else {
            // For INSERT: match by array index (Bulk API preserves order for small batches)
            // This is less reliable for large datasets but works for most cases
            for (let i = 0; i < bulkResults.successfulResults.length; i++) {
                const s = bulkResults.successfulResults[i];
                if (i < readyRecords.length && s.sf__Id) {
                    const srcId = readyRecords[i].srcId;
                    if (srcId) successBySrcId.set(String(srcId), s.sf__Id);
                }
            }

            for (let i = 0; i < bulkResults.failedResults.length; i++) {
                const f = bulkResults.failedResults[i];
                if (i < readyRecords.length) {
                    const srcId = readyRecords[i].srcId;
                    if (srcId) failedBySrcId.set(String(srcId), f.sf__Error || 'Unknown error');
                }
            }
        }

        // Build RecordIdMap entries for successful loads
        const idMapRows = [];
        for (const rec of readyRecords) {
            const srcIdKey = rec.srcId ? String(rec.srcId) : null;
            if (!srcIdKey) continue;

            if (successBySrcId.has(srcIdKey)) {
                const targetId = successBySrcId.get(srcIdKey);
                stg3Rows.push(makeStg3Row(rec.srcId, sourceObjectName, 'loaded', null, targetId, ctx.runId, rec.values));
                result.loaded += 1;

                idMapRows.push({
                    sourceOrgId: ctx.sourceOrgId,
                    targetOrgId: ctx.targetOrgId,
                    objectName: sourceObjectName,
                    sourceRecordId: srcIdKey,
                    targetRecordId: targetId,
                    migrationJobId: null,
                });
            } else if (failedBySrcId.has(srcIdKey)) {
                stg3Rows.push(makeStg3Row(rec.srcId, sourceObjectName, 'failed', failedBySrcId.get(srcIdKey), null, ctx.runId, rec.values));
                result.failed += 1;
            } else if (unprocessedSet.has(srcIdKey)) {
                stg3Rows.push(makeStg3Row(rec.srcId, sourceObjectName, 'unprocessed', 'Not processed by Bulk job', null, ctx.runId, rec.values));
                result.failed += 1;
            } else {
                stg3Rows.push(makeStg3Row(rec.srcId, sourceObjectName, 'failed', 'No Bulk result returned for record', null, ctx.runId, rec.values));
                result.failed += 1;
            }
        }
        // Store RecordIdMap entries for child object lookups
        await insertStg3Rows(stg3Table, targetColumns, stg3Rows);

        if (idMapRows.length > 0) {
            try {
                await recordIdMapRepository.setTargetIds(idMapRows);
                // Refresh the in-memory id map for this object so children see the new ids
                ctx.idMaps.delete(sourceObjectName);
            } catch (cacheError) {
                log.error('RecordIdMap cache update failed', cacheError, { targetObjectName, rowCount: idMapRows.length });
                throw cacheError;
            }
        }

        const { successCsv, errorCsv } = await writeObjectCsvs(ctx.loadDir, targetObjectName, stg3Rows);
        result.successCsv = successCsv;
        result.errorCsv = errorCsv;

        // Reflect actual outcome in status
        if (result.loaded === 0 && result.total > 0) {
            result.status = 'failed';
            result.errorMessage = result.errorMessage || 'No records were loaded';
        } else {
            result.status = 'success';
        }
        log.info('Object loaded (pass 1)', {
            targetObjectName, operation, total: result.total, loaded: result.loaded,
            failed: result.failed, skipped: result.skipped,
        });
    } catch (error) {
        result.errorMessage = error.message || String(error);
        log.error('Object load failed (pass 1)', error, { targetObjectName });
    }

    return result;
}

/**
 * Fill the deferred (cut/self-ref) lookups for one object via Bulk update (pass 2).
 */
async function loadObjectPass2({ ctx, node, mappings, deferredForObject, result }) {
    const { sourceObjectName, targetObjectName, targetObjectId } = node;

    try {
        // Map each deferred source field to its target column + parent source object.
        const deferredColumns = new Map(); // targetColumn -> parent SOURCE object name
        for (const d of deferredForObject) {
            const m = mappings.find((mm) => mm.sourceField?.name === d.fieldName);
            if (!m?.targetField?.name) continue;
            deferredColumns.set(sanitizeColumnName(m.targetField.name), d.referencedObjectName);
        }
        if (deferredColumns.size === 0) return;

        const stg2Table = transformService.getStg2TableName(ctx.targetOrgId, targetObjectName);
        if (!(await tableExists(stg2Table))) return;
        const runId = await getLatestRunId(stg2Table);
        if (!runId) return;
        const stg2Rows = await readSuccessRows(stg2Table, runId);

        const ownSourceIds = stg2Rows.map((row) => row.__srcId).filter(Boolean);
        const ownMap = await getIdMap(ctx, sourceObjectName, ownSourceIds, true);
        const parentObjects = new Set([...deferredColumns.values()]);
        const deferredSourceIdsByParent = collectLookupSourceIds(stg2Rows, [...deferredColumns.keys()], deferredColumns);
        for (const parent of parentObjects) {
            await getIdMap(ctx, parent, deferredSourceIdsByParent.get(parent) || [], true);
        }

        const updateRecords = [];
        for (const row of stg2Rows) {
            const targetId = ownMap.get(String(row.__srcId));
            if (!targetId) continue; // this record was never loaded

            const update = { Id: targetId };
            let hasValue = false;
            for (const [col, parentObj] of deferredColumns) {
                const sourceParentId = row[col];
                if (sourceParentId === null || sourceParentId === undefined || String(sourceParentId) === '') continue;
                const parentMap = await getIdMap(ctx, parentObj, [sourceParentId]);
                const resolved = parentMap.get(String(sourceParentId));
                if (resolved) { update[col] = resolved; hasValue = true; }
            }
            if (hasValue) updateRecords.push(update);
        }

        if (updateRecords.length === 0) return;

        const bulkResults = await bulkIngestService.ingestRecords({
            conn: ctx.conn,
            objectName: targetObjectName,
            operation: 'update',
            records: updateRecords,
        });

        result.deferredUpdated = bulkResults.successfulResults.length;
        const deferredFailed = bulkResults.failedResults.length;
        if (deferredFailed > 0) {
            const rows = bulkResults.failedResults.map((f) => ({
                __srcId: '',
                __status: 'deferred-update-failed',
                __error: `${f.Id || ''}: ${f.sf__Error || 'Unknown error'}`,
            }));
            await appendErrorCsv(ctx.loadDir, targetObjectName, rows);
        }
        log.info('Object deferred lookups updated (pass 2)', {
            targetObjectName, updated: result.deferredUpdated, failed: deferredFailed,
        });
        void targetObjectId;
    } catch (error) {
        log.error('Object deferred update failed (pass 2)', error, { targetObjectName });
    }
}

/* ------------------------------------------------------------------ *
 * id-map context
 * ------------------------------------------------------------------ */

function collectLookupSourceIds(rows, columns, lookupRemap) {
    const byParent = new Map();
    for (const row of rows) {
        for (const col of columns) {
            if (!lookupRemap.has(col)) continue;
            const raw = row[col];
            if (raw === null || raw === undefined || String(raw) === '') continue;
            const parent = lookupRemap.get(col);
            if (!byParent.has(parent)) byParent.set(parent, new Set());
            byParent.get(parent).add(String(raw));
        }
    }
    return byParent;
}

function getFirstReferenceTargetName(referenceTo) {
    if (!Array.isArray(referenceTo) || referenceTo.length === 0) return null;
    const ref = referenceTo[0];
    if (typeof ref === 'string') return ref;
    if (ref && typeof ref === 'object') {
        return ref.objectApiName || ref.name || ref.sobject || ref.targetObjectName || null;
    }
    return null;
}

/**
 * Resolve source -> target record Ids for one source object, primarily from
 * RecordIdMap (populated by pass-1 loads). Used to remap lookup columns.
 *
 * No SOQL fallback: with the new traceback model the chosen key field can be
 * anything (or a tuple), so we can't generically rediscover existing records
 * from the target org. RecordIdMap is the source of truth.
 */
async function getIdMap(ctx, sourceObjectName, sourceRecordIds = [], refresh = false) {
    if (refresh) ctx.idMaps.delete(sourceObjectName);
    if (!ctx.idMaps.has(sourceObjectName)) ctx.idMaps.set(sourceObjectName, new Map());

    const map = ctx.idMaps.get(sourceObjectName);
    const requestedIds = uniqueStrings(sourceRecordIds);
    const missingIds = requestedIds.filter((id) => !map.has(id));
    if (missingIds.length === 0) return map;

    const rows = await recordIdMapRepository.findByObject({
        sourceOrgId: ctx.sourceOrgId,
        targetOrgId: ctx.targetOrgId,
        objectName: sourceObjectName,
    });
    for (const row of rows) {
        if (row.targetRecordId) map.set(String(row.sourceRecordId), row.targetRecordId);
    }
    return map;
}

function uniqueStrings(values) {
    const list = values === null || values === undefined
        ? []
        : (typeof values === 'string' || typeof values[Symbol.iterator] !== 'function')
            ? [values]
            : Array.from(values);

    return [...new Set(list
        .filter((value) => value !== null && value !== undefined && String(value) !== '')
        .map((value) => String(value)))];
}

function chunkArray(values, size) {
    const chunks = [];
    for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
    return chunks;
}

/* ------------------------------------------------------------------ *
 * stg3 row helpers
 * ------------------------------------------------------------------ */

function makeStg3Row(srcId, srcObject, status, error, targetId, runId, values) {
    return {
        __srcId: srcId ?? null,
        __srcObject: srcObject,
        __status: status,
        __error: error ?? null,
        __targetId: targetId ?? null,
        __runId: runId,
        values: values || {},
    };
}

/* ------------------------------------------------------------------ *
 * Dynamic stg2/stg3 table access
 * ------------------------------------------------------------------ */

async function getLatestRunId(stg2Table) {
    const [rows] = await db.sequelize.query(
        `SELECT "__runId" AS runid FROM ${quoteIdentifier(stg2Table)} ORDER BY "__transformedAt" DESC LIMIT 1;`,
    );
    return rows?.[0]?.runid || null;
}

async function readSuccessRows(stg2Table, runId) {
    const [rows] = await db.sequelize.query(
        `SELECT * FROM ${quoteIdentifier(stg2Table)} WHERE "__runId" = $1 AND "__status" = 'success';`,
        { bind: [runId] },
    );
    return rows;
}

async function ensureStg3Table(tableName, fieldColumns) {
    const quotedTable = quoteIdentifier(tableName);

    await db.sequelize.query(`
        CREATE TABLE IF NOT EXISTS ${quotedTable} (
            ${quoteIdentifier('__rowId')} BIGSERIAL PRIMARY KEY,
            ${quoteIdentifier('__srcId')} TEXT,
            ${quoteIdentifier('__srcObject')} TEXT,
            ${quoteIdentifier('__status')} TEXT,
            ${quoteIdentifier('__error')} TEXT,
            ${quoteIdentifier('__targetId')} TEXT,
            ${quoteIdentifier('__runId')} UUID,
            ${quoteIdentifier('__generatedAt')} TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    for (const col of fieldColumns) {
        await db.sequelize.query(`ALTER TABLE ${quotedTable} ADD COLUMN IF NOT EXISTS ${quoteIdentifier(col)} TEXT;`);
    }
}

async function insertStg3Rows(tableName, fieldColumns, rows) {
    if (rows.length === 0) return;

    const quotedTable = quoteIdentifier(tableName);
    const columns = [...STG3_META_INSERT_COLUMNS, ...fieldColumns];
    const quotedColumns = columns.map(quoteIdentifier).join(', ');

    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
        const values = [];
        const placeholders = [];
        let idx = 1;

        for (const row of batch) {
            const rowPlaceholders = [];
            for (const col of STG3_META_INSERT_COLUMNS) {
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

async function tableExists(tableName) {
    const [rows] = await db.sequelize.query(
        `SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = $1
        ) AS exists;`,
        { bind: [tableName] },
    );
    return !!rows?.[0]?.exists;
}

/* ------------------------------------------------------------------ *
 * CSV reporting
 * ------------------------------------------------------------------ */

async function writeObjectCsvs(loadDir, objectName, stg3Rows) {
    const safe = sanitizeForFileName(objectName);
    const successRows = stg3Rows.filter((r) => r.__status === 'loaded');
    const errorRows = stg3Rows.filter((r) => r.__status !== 'loaded');

    // Always write both files (empty header-only CSV if no rows of that type)
    const successCsv = path.join(loadDir, `${safe}_success.csv`);
    await fs.writeFile(successCsv, toCsv(['__srcId', '__targetId'], successRows), 'utf8');

    const errorCsv = path.join(loadDir, `${safe}_errors.csv`);
    await fs.writeFile(errorCsv, toCsv(['__srcId', '__status', '__error'], errorRows), 'utf8');

    return { successCsv, errorCsv };
}

async function appendErrorCsv(loadDir, objectName, rows) {
    if (rows.length === 0) return;
    const safe = sanitizeForFileName(objectName);
    const errorCsv = path.join(loadDir, `${safe}_errors.csv`);
    const exists = await fs.access(errorCsv).then(() => true).catch(() => false);
    const headers = ['__srcId', '__status', '__error'];
    const body = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(',')).join('\r\n');
    if (exists) {
        await fs.appendFile(errorCsv, `\r\n${body}`, 'utf8');
    } else {
        await fs.writeFile(errorCsv, `${headers.join(',')}\r\n${body}`, 'utf8');
    }
}

function toCsv(headers, rows) {
    const lines = [headers.join(',')];
    for (const r of rows) {
        lines.push(headers.map((h) => csvEscape(r[h])).join(','));
    }
    return lines.join('\r\n');
}

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ------------------------------------------------------------------ *
 * Naming / sanitization (mirrors transform/extraction conventions)
 * ------------------------------------------------------------------ */

function getStg3TableName(targetOrgId, targetObjectName) {
    const orgPart = String(targetOrgId).replace(/[^A-Za-z0-9_]/g, '_');
    const objectPart = String(targetObjectName).replace(/[^A-Za-z0-9_]/g, '_');

    const raw = `stg3_${orgPart}_${objectPart}`;
    if (raw.length <= 63) return raw;

    const hash = createHash('sha1').update(raw).digest('hex').slice(0, 8);
    const maxObjectPartLength = Math.max(1, 63 - (`stg3_${orgPart}_`.length + 9));
    const trimmedObjectPart = objectPart.slice(0, maxObjectPartLength);
    return `stg3_${orgPart}_${trimmedObjectPart}_${hash}`;
}

function sanitizeColumnName(name) {
    return String(name || '')
        .trim()
        .replace(/^\uFEFF/, '')
        .replace(/[^A-Za-z0-9_]/g, '_') || 'col';
}

function sanitizeForFileName(name) {
    return String(name || 'object').replace(/[^A-Za-z0-9_.-]/g, '_');
}

function quoteIdentifier(identifier) {
    return `"${String(identifier).replace(/"/g, '""')}"`;
}

/* ------------------------------------------------------------------ *
 * Result access for the UI (persisted stg3 rows + CSV downloads)
 * ------------------------------------------------------------------ */

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Read the persisted stg3 result rows for one target object (latest run).
 * @param {object} p
 * @param {string} p.targetOrgId
 * @param {string} p.targetObjectName
 * @param {string} [p.status] 'loaded'|'failed'|'skipped'|'skipped-already-loaded'|'unprocessed'|'all'
 * @param {number} [p.limit] max rows (default 500, capped at 5000)
 * @returns {Promise<{runId: string|null, records: Array}>}
 */
async function getLoadRecords({ targetOrgId, targetObjectName, status = 'all', limit = 500 }) {
    if (!targetOrgId || !targetObjectName) {
        throw new Error('targetOrgId and targetObjectName are required');
    }
    const table = getStg3TableName(targetOrgId, targetObjectName);
    if (!(await tableExists(table))) return { runId: null, records: [] };

    const runId = await getStg3LatestRunId(table);
    if (!runId) return { runId: null, records: [] };

    const cap = Math.min(Math.max(Number(limit) || 500, 1), 5000);
    const quoted = quoteIdentifier(table);

    const bind = [runId];
    let where = '"__runId" = $1';
    if (status && status !== 'all') {
        bind.push(status);
        where += ' AND "__status" = $2';
    }

    const [rows] = await db.sequelize.query(
        `SELECT "__srcId", "__srcObject", "__status", "__error", "__targetId"
         FROM ${quoted} WHERE ${where} ORDER BY "__rowId" ASC LIMIT ${cap};`,
        { bind },
    );
    return { runId, records: rows };
}

async function getStg3LatestRunId(table) {
    const [rows] = await db.sequelize.query(
        `SELECT "__runId" AS runid FROM ${quoteIdentifier(table)} ORDER BY "__generatedAt" DESC LIMIT 1;`,
    );
    return rows?.[0]?.runid || null;
}

/**
 * Resolve a load CSV file path from safe components (no client-supplied raw paths).
 * Guards against path traversal by validating ids and asserting the resolved path
 * stays under the org's Load base directory.
 * @returns {Promise<string|null>} absolute path if the file exists, else null.
 */
async function resolveLoadCsvPath({ targetOrgId, runId, objectName, type }) {
    if (!targetOrgId || !runId || !objectName) {
        throw new Error('targetOrgId, runId and objectName are required');
    }
    if (!UUID_RE.test(String(targetOrgId)) || !UUID_RE.test(String(runId))) {
        throw new Error('Invalid targetOrgId or runId');
    }
    const suffix = type === 'success' ? 'success' : 'errors';
    const safeObject = sanitizeForFileName(objectName);

    const baseDir = path.resolve(__dirname, '..', '..', 'data', String(targetOrgId), 'Load', String(runId));
    const filePath = path.resolve(baseDir, `${safeObject}_${suffix}.csv`);
    if (filePath !== baseDir && !filePath.startsWith(baseDir + path.sep)) {
        throw new Error('Resolved path escapes the load directory');
    }
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    return exists ? filePath : null;
}

export default {
    runLoad,
    getLoadStatus,
    setLoadStatus,
    getLoadRecords,
    resolveLoadCsvPath,
};
