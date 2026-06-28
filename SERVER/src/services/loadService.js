/**
 * Load Service — roadmap 5.3 (stg3) + 5.4 (LOAD).
 *
 * Builds the insert-ready "stg3" tables from the transformed stg2 data and loads
 * them into the target org via Bulk API 2.0, in dependency order.
 *
 * Model (see /memories/session/plan-phase-E-pipeline.md "LOAD CORRELATION DECISION"):
 *  - Objects load parents-first using dependencyService.getLoadPlan. Cyclic /
 *    self-referential lookups are cut ("deferredFields") and filled in a 2nd pass.
 *  - stg3 is built per target object from the LATEST stg2 run, success rows only.
 *    One stg2 row -> one stg3 row. Lookup columns are remapped from the SOURCE
 *    parent Id to the TARGET parent Id by resolving the parent target record via
 *    its selected External Id field (which stores the SOURCE record Id).
 *  - Correlation: the user-selected External Id field (per object pair) is written
 *    with the SOURCE record Id. Bulk echoes it back next to sf__Id / sf__Error, so
 *    each result row maps back to its source record (Bulk result order is not
 *    guaranteed). Captured target Ids are optionally cached in RecordIdMap.
 *  - Operation is upsert by the selected External Id field, making load reruns
 *    idempotent and allowing previously-created target records to be matched.
 *  - Cascade: if a parent record was not loaded, the child row is NOT loaded and the
 *    reason is recorded (stg3 __status/__error + an error CSV).
 *
 * Out of scope: update/upsert via external Id, polymorphic lookup remap.
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
        nodesBySourceObjectName: new Map(loadOrder.map((node) => [node.sourceObjectName, node])),
    };

    const results = [];
    const totalObjects = loadOrder.length;
    let completed = 0;
    setLoadProgress(sourceOrgId, targetOrgId, { pass: 1, total: totalObjects, completed, currentObject: null, results: [...results] });

    // PASS 1 — insert each object in dependency order.
    for (const node of loadOrder) {
        setLoadProgress(sourceOrgId, targetOrgId, { pass: 1, total: totalObjects, completed, currentObject: node.targetObjectName, results: [...results] });
        const mappings = mappingsByTarget.get(node.targetObjectId) || [];
        const deferredForObject = deferredFields.filter((d) => d.sourceObjectId === node.sourceObjectId);
        const result = await loadObjectPass1({ ctx, node, mappings, deferredForObject });
        results.push(result);
        completed += 1;
        setLoadProgress(sourceOrgId, targetOrgId, { pass: 1, total: totalObjects, completed, currentObject: null, results: [...results] });
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
 * Build stg3 for one object and Bulk-insert the ready rows (pass 1).
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
        // The user must have chosen an External Id field for load traceback.
        const traceback = await tracebackService.getSelectedExternalIdField(sourceObjectId, targetObjectId);
        if (!traceback) {
            result.status = 'skipped';
            result.errorMessage = 'No External Id field selected for load traceback; object not migrated.';
            log.warn('Object skipped: no traceback field', { targetObjectName });
            return result;
        }
        const extIdColumn = traceback.name;

        // Target field columns (sanitized API names, deduped) + lookup / deferred maps.
        const targetColumns = [];
        const seen = new Set();
        const lookupRemap = new Map();    // targetColumn -> parent SOURCE object name
        const deferredColumns = new Map(); // targetColumn -> parent SOURCE object name
        for (const m of mappings) {
            if (!m.targetField?.name) continue;
            const col = sanitizeColumnName(m.targetField.name);
            if (!seen.has(col)) { seen.add(col); targetColumns.push(col); }

            // as-is lookup mapping: source field references a parent object -> remap target column.
            if (m.mappingType === 'as-is' && Array.isArray(m.sourceField?.referenceTo) && m.sourceField.referenceTo.length > 0) {
                const referencedObjectName = getFirstReferenceTargetName(m.sourceField.referenceTo);
                if (referencedObjectName) lookupRemap.set(col, referencedObjectName);
            }
        }
        // Deferred (cut/self-ref) source fields -> their target columns are filled in pass 2.
        for (const d of deferredForObject) {
            const m = mappings.find((mm) => mm.sourceField?.name === d.fieldName);
            if (!m?.targetField?.name) continue;
            deferredColumns.set(sanitizeColumnName(m.targetField.name), d.referencedObjectName);
        }

        // Conflict: the traceback field cannot also be a user-mapped target column (we'd overwrite it).
        if (seen.has(extIdColumn)) {
            result.status = 'skipped';
            result.errorMessage = `Traceback External Id field "${extIdColumn}" is also a mapped target field; resolve the conflict. Object not migrated.`;
            log.warn('Object skipped: traceback field conflict', { targetObjectName, extIdColumn });
            return result;
        }

        // Read the latest successful stg2 run.
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
        const ownSourceIds = stg2Rows.map((row) => row.__srcId).filter(Boolean);
        const existingOwnMap = await getIdMap(ctx, sourceObjectName, ownSourceIds, true);

        // Preload the target Ids for parent objects referenced by lookups. Parent
        // records are resolved in the target org through their selected External Id
        // field, whose value is the original source record Id.
        const lookupSourceIdsByParent = collectLookupSourceIds(stg2Rows, targetColumns, lookupRemap);
        for (const [parent, sourceIds] of lookupSourceIdsByParent) {
            await getIdMap(ctx, parent, sourceIds);
        }

        // stg3 columns = target field columns + the traceback External Id column.
        const stg3Columns = [...targetColumns];
        if (!stg3Columns.includes(extIdColumn)) stg3Columns.push(extIdColumn);

        const stg3Table = getStg3TableName(ctx.targetOrgId, targetObjectName);
        result.stg3Table = stg3Table;
        await ensureStg3Table(stg3Table, stg3Columns);

        const stg3Rows = [];   // every stg3 row (ready + skipped) for audit
        const readyRecords = []; // { srcId, values } sent to Bulk
        for (const row of stg2Rows) {
            const srcId = row.__srcId;

            if (srcId && existingOwnMap.has(String(srcId))) {
                stg3Rows.push(makeStg3Row(
                    srcId,
                    sourceObjectName,
                    'skipped-already-loaded',
                    'Already exists in the target org by External Id',
                    existingOwnMap.get(String(srcId)),
                    ctx.runId,
                    {},
                ));
                result.skipped += 1;
                continue;
            }

            const values = {};
            let rowError = null;
            for (const col of targetColumns) {
                const raw = row[col];
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
                } else if (deferredColumns.has(col)) {
                    values[col] = null;
                } else {
                    values[col] = raw ?? null;
                }
            }

            if (rowError) {
                stg3Rows.push(makeStg3Row(srcId, sourceObjectName, 'skipped', rowError, null, ctx.runId, {}));
                result.skipped += 1;
                continue;
            }

            values[extIdColumn] = srcId; // correlation token
            readyRecords.push({ srcId, values });
            result.ready += 1;
        }

        // Bulk upsert the ready records by the selected External Id field.
        let bulkResults = { successfulResults: [], failedResults: [], unprocessedRecords: [] };
        if (readyRecords.length > 0) {
            bulkResults = await bulkIngestService.ingestRecords({
                conn: ctx.conn,
                objectName: targetObjectName,
                operation: 'upsert',
                externalIdFieldName: extIdColumn,
                records: readyRecords.map((r) => r.values),
            });
        }

        // Correlate results back to source records via the echoed External Id column.
        const idMapRows = [];
        const successById = new Map();
        const successfulSourceIds = [];
        for (const s of bulkResults.successfulResults) {
            const srcId = s[extIdColumn];
            const targetId = s.sf__Id;
            if (srcId && targetId) {
                successById.set(String(srcId), targetId);
            }
            if (srcId) successfulSourceIds.push(srcId);
        }
        if (successfulSourceIds.length > 0) {
            const resolved = await getIdMap(ctx, sourceObjectName, successfulSourceIds, true);
            for (const srcId of successfulSourceIds) {
                const key = String(srcId);
                const targetId = successById.get(key) || resolved.get(key);
                if (!targetId) continue;
                successById.set(key, targetId);
                idMapRows.push({
                    sourceOrgId: ctx.sourceOrgId,
                    targetOrgId: ctx.targetOrgId,
                    objectName: sourceObjectName,
                    sourceRecordId: key,
                    targetRecordId: targetId,
                    migrationJobId: null,
                });
            }
        }
        const failedById = new Map();
        for (const f of bulkResults.failedResults) {
            const srcId = f[extIdColumn];
            if (srcId) failedById.set(String(srcId), f.sf__Error || 'Unknown error');
        }
        const unprocessed = Array.isArray(bulkResults.unprocessedRecords) ? bulkResults.unprocessedRecords : [];
        const unprocessedIds = new Set(unprocessed.map((u) => String(u?.[extIdColumn])).filter(Boolean));

        // Final stg3 rows for the ready records.
        for (const rec of readyRecords) {
            const key = String(rec.srcId);
            const fieldValues = stripExtId(rec.values, extIdColumn);
            if (successById.has(key)) {
                stg3Rows.push(makeStg3Row(rec.srcId, sourceObjectName, 'loaded', null, successById.get(key), ctx.runId, rec.values));
                result.loaded += 1;
            } else if (failedById.has(key)) {
                stg3Rows.push(makeStg3Row(rec.srcId, sourceObjectName, 'failed', failedById.get(key), null, ctx.runId, rec.values));
                result.failed += 1;
            } else if (unprocessedIds.has(key)) {
                stg3Rows.push(makeStg3Row(rec.srcId, sourceObjectName, 'unprocessed', 'Not processed by Bulk job', null, ctx.runId, rec.values));
                result.failed += 1;
            } else {
                stg3Rows.push(makeStg3Row(rec.srcId, sourceObjectName, 'failed', 'No Bulk result returned for record', null, ctx.runId, rec.values));
                result.failed += 1;
            }
            void fieldValues;
        }

        await insertStg3Rows(stg3Table, stg3Columns, stg3Rows);

        if (idMapRows.length > 0) {
            try {
                await recordIdMapRepository.setTargetIds(idMapRows);
            } catch (cacheError) {
                log.warn('RecordIdMap cache update failed; continuing because External Id is the load source of truth', cacheError, {
                    targetObjectName,
                    rowCount: idMapRows.length,
                });
            }
        }

        // Per-object success / error CSVs.
        const { successCsv, errorCsv } = await writeObjectCsvs(ctx.loadDir, targetObjectName, stg3Rows);
        result.successCsv = successCsv;
        result.errorCsv = errorCsv;

        result.status = 'success';
        log.info('Object loaded (pass 1)', {
            targetObjectName, total: result.total, loaded: result.loaded, failed: result.failed, skipped: result.skipped,
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

async function getIdMap(ctx, sourceObjectName, sourceRecordIds = [], refresh = false) {
    if (refresh) ctx.idMaps.delete(sourceObjectName);
    if (!ctx.idMaps.has(sourceObjectName)) ctx.idMaps.set(sourceObjectName, new Map());

    const map = ctx.idMaps.get(sourceObjectName);
    const requestedIds = uniqueStrings(sourceRecordIds);
    const missingIds = requestedIds.filter((id) => !map.has(id));
    if (missingIds.length === 0) return map;

    const node = ctx.nodesBySourceObjectName.get(sourceObjectName);
    const targetObjectName = node?.targetObjectName || sourceObjectName;

    if (node?.sourceObjectId && node?.targetObjectId) {
        const externalIdField = await tracebackService.getSelectedExternalIdField(node.sourceObjectId, node.targetObjectId);
        if (externalIdField?.name) {
            const resolved = await queryTargetIdsByExternalId(ctx.conn, {
                objectName: targetObjectName,
                externalIdFieldName: externalIdField.name,
                externalIdValues: missingIds,
            });
            mergeIntoMap(map, resolved);
        } else {
            log.warn('Cannot resolve lookup by External Id because no field is selected', {
                sourceObjectName,
                targetObjectName,
            });
        }
    } else {
        log.warn('Cannot resolve lookup by External Id because parent object is not in the load plan', {
            sourceObjectName,
            targetObjectName,
        });
    }

    const unresolvedIds = missingIds.filter((id) => !map.has(id));
    if (unresolvedIds.length > 0) {
        const existingTargetIds = await queryExistingTargetIds(ctx.conn, {
            objectName: targetObjectName,
            ids: unresolvedIds,
        });
        mergeIntoMap(map, existingTargetIds);
    }

    return map;
}

async function queryTargetIdsByExternalId(conn, { objectName, externalIdFieldName, externalIdValues }) {
    const values = uniqueStrings(externalIdValues);
    const resolved = new Map();
    if (values.length === 0) return resolved;

    const safeObjectName = assertSalesforceApiName(objectName, 'objectName');
    const safeExternalIdFieldName = assertSalesforceApiName(externalIdFieldName, 'externalIdFieldName');

    for (const chunk of chunkArray(values, 200)) {
        const literals = chunk.map((value) => `'${escapeSoqlLiteral(value)}'`).join(', ');
        const soql = `SELECT Id, ${safeExternalIdFieldName} FROM ${safeObjectName} WHERE ${safeExternalIdFieldName} IN (${literals})`;
        const result = await conn.query(soql);
        for (const record of result.records || []) {
            const sourceId = record[safeExternalIdFieldName];
            if (sourceId && record.Id) resolved.set(String(sourceId), record.Id);
        }
    }
    return resolved;
}

async function queryExistingTargetIds(conn, { objectName, ids }) {
    const values = uniqueStrings(ids);
    const resolved = new Map();
    if (values.length === 0) return resolved;

    const safeObjectName = assertSalesforceApiName(objectName, 'objectName');
    for (const chunk of chunkArray(values, 200)) {
        const literals = chunk.map((value) => `'${escapeSoqlLiteral(value)}'`).join(', ');
        const soql = `SELECT Id FROM ${safeObjectName} WHERE Id IN (${literals})`;
        const result = await conn.query(soql);
        for (const record of result.records || []) {
            if (record.Id) resolved.set(String(record.Id), record.Id);
        }
    }
    return resolved;
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

function mergeIntoMap(target, source) {
    for (const [key, value] of source) target.set(key, value);
}

function chunkArray(values, size) {
    const chunks = [];
    for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
    return chunks;
}

function assertSalesforceApiName(name, label) {
    const value = String(name || '');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
        throw new Error(`Invalid Salesforce ${label}: ${value}`);
    }
    return value;
}

function escapeSoqlLiteral(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
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

function stripExtId(values, extIdColumn) {
    const { [extIdColumn]: _omit, ...rest } = values;
    return rest;
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

    let successCsv = null;
    let errorCsv = null;

    if (successRows.length > 0) {
        successCsv = path.join(loadDir, `${safe}_success.csv`);
        await fs.writeFile(successCsv, toCsv(['__srcId', '__targetId'], successRows), 'utf8');
    }
    if (errorRows.length > 0) {
        errorCsv = path.join(loadDir, `${safe}_errors.csv`);
        await fs.writeFile(errorCsv, toCsv(['__srcId', '__status', '__error'], errorRows), 'utf8');
    }
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
