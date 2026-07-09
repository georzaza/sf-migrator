/**
 * Load Service — roadmap 5.3 (stg3) + 5.4 (LOAD).
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
 *  - LOAD CORRELATION is driven by the per-object traceback config (see
 *    tracebackService) and has 4 strategies:
 *      * 'external-id' / 'unique' / 'alphanumeric' (single field): the SOURCE
 *        record Id is written into the chosen target field at insert time. The
 *        Bulk insert response echoes that field back next to sf__Id, giving us
 *        a direct source -> target reconciliation. Existing target records
 *        (re-runs) are detected up front via SOQL `WHERE field IN (sourceIds)`
 *        and skipped for idempotency.
 *      * 'composite' (2+ fields): the user-mapped values are inserted as-is.
 *        The Bulk insert response echoes the chosen fields back, so each
 *        source row is reconciled by tuple equality. Existing target records
 *        are detected via a tuple OR-of-AND SOQL pre-query.
 *  - Bulk results are always treated as INSERT — we never call upsert anymore,
 *    since tiers 2/3/4 are not (necessarily) backed by Salesforce externalId.
 *  - Ambiguity = abort: if any source row matches more than one target record
 *    during reconciliation or the pre-existence check, the entire load is
 *    failed (per product spec).
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

    // PASS 1 — insert each object in dependency order.
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
        if (error instanceof AmbiguousTargetMatchError) {
            log.error('Load aborted: ambiguous target match', error, { runId, sourceOrgId, targetOrgId });
            const summary = {
                runId, sourceOrgId, targetOrgId,
                objectCount: results.length, loadDir, results,
                aborted: true, error: error.message,
            };
            return summary;
        }
        throw error;
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
 * Build stg3 for one object, run the configured traceback strategy, Bulk-insert
 * the ready rows, and reconcile target Ids (pass 1).
 *
 * Throws an `AmbiguousTargetMatchError` if reconciliation finds more than one
 * target record for a single source row — the caller (runLoad) propagates that
 * to abort the entire load.
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
        const traceback = await tracebackService.getTraceback(sourceObjectId, targetObjectId);
        if (!traceback.strategy || traceback.fields.length === 0) {
            result.status = 'skipped';
            result.errorMessage = 'No traceback configured for this object pair; object not migrated.';
            log.warn('Object skipped: no traceback configured', { targetObjectName });
            return result;
        }
        const strategy = traceback.strategy;
        const tracebackColumns = traceback.fields.map((f) => sanitizeColumnName(f.name));
        const isCompositeStrategy = strategy === 'composite';
        // For single-field strategies the loader writes the SOURCE record Id into
        // the chosen column at insert time, overwriting any user mapping for it.
        const overrideColumn = isCompositeStrategy ? null : tracebackColumns[0];

        // Target field columns (sanitized API names, deduped) + lookup / deferred maps.
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

        // For composite strategy, every traceback column MUST also be a user-
        // mapped target column (we cannot fabricate a tuple value), otherwise
        // the load is unreconcilable.
        if (isCompositeStrategy) {
            const missing = tracebackColumns.filter((c) => !seen.has(c));
            if (missing.length > 0) {
                result.status = 'skipped';
                result.errorMessage = `Composite traceback fields are not user-mapped: ${missing.join(', ')}. Map them or pick different fields.`;
                log.warn('Object skipped: composite traceback fields not mapped', { targetObjectName, missing });
                return result;
            }
        }

        // Single-field tiers OVERWRITE any user mapping for the chosen column
        // with the source record Id at insert. We log the conflict — the
        // validation service surfaces it to the UI as an advisory warning.
        if (overrideColumn && seen.has(overrideColumn)) {
            log.info('Traceback field overrides user mapping for this object', {
                targetObjectName, column: overrideColumn,
            });
        }
        // Ensure the override column ends up in the insert payload even if the
        // user did not map it.
        if (overrideColumn && !seen.has(overrideColumn)) {
            seen.add(overrideColumn);
            targetColumns.push(overrideColumn);
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

        // Preload parent target Ids (lookup remap) from the RecordIdMap cache.
        const lookupSourceIdsByParent = collectLookupSourceIds(stg2Rows, targetColumns, lookupRemap);
        for (const [parent, sourceIds] of lookupSourceIdsByParent) {
            await getIdMap(ctx, parent, sourceIds);
        }

        // stg3 columns = the union of target field columns and any traceback columns.
        const stg3Columns = [...targetColumns];
        for (const col of tracebackColumns) {
            if (!stg3Columns.includes(col)) stg3Columns.push(col);
        }

        const stg3Table = getStg3TableName(ctx.targetOrgId, targetObjectName);
        result.stg3Table = stg3Table;
        await ensureStg3Table(stg3Table, stg3Columns);

        // Detect already-existing target records (idempotency).
        // Single-field tiers: SOQL `WHERE F IN (sourceIds)`.
        // Composite tier: tuple OR-of-AND pre-query built once after rows are ready.
        let existingOwnMap = new Map();
        if (!isCompositeStrategy) {
            const ownSourceIds = stg2Rows.map((row) => row.__srcId).filter(Boolean);
            existingOwnMap = await queryTargetIdsByField(ctx.conn, {
                objectName: targetObjectName,
                fieldName: overrideColumn,
                values: ownSourceIds,
            });
        }

        const stg3Rows = [];
        const readyRecords = []; // { srcId, values, key } sent to Bulk
        for (const row of stg2Rows) {
            const srcId = row.__srcId;

            // Build the prospective insert payload first; we may need its
            // values to compute the composite key or the override value.
            const values = {};
            let rowError = null;
            for (const col of targetColumns) {
                if (col === overrideColumn) continue; // set below
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
            if (overrideColumn) values[overrideColumn] = srcId;

            if (rowError) {
                stg3Rows.push(makeStg3Row(srcId, sourceObjectName, 'skipped', rowError, null, ctx.runId, values));
                result.skipped += 1;
                continue;
            }

            // Compute the row's reconciliation key.
            const key = isCompositeStrategy
                ? compositeKeyFromValues(values, tracebackColumns)
                : srcId != null ? String(srcId) : null;

            if (!isCompositeStrategy && srcId && existingOwnMap.has(String(srcId))) {
                stg3Rows.push(makeStg3Row(
                    srcId, sourceObjectName, 'skipped-already-loaded',
                    'Already exists in the target org by traceback field',
                    existingOwnMap.get(String(srcId)), ctx.runId, values,
                ));
                result.skipped += 1;
                continue;
            }

            readyRecords.push({ srcId, values, key });
            result.ready += 1;
        }

        // Composite tier: pre-existence check via tuple OR-clause.
        let existingCompositeByKey = new Map();
        if (isCompositeStrategy && readyRecords.length > 0) {
            const lookupResult = await queryTargetIdsByTuples(ctx.conn, {
                objectName: targetObjectName,
                fieldNames: tracebackColumns,
                tuples: readyRecords.map((r) => tracebackColumns.map((c) => r.values[c])),
            });
            assertNoAmbiguousMatches(lookupResult.ambiguousKeys, targetObjectName, 'pre-existence check');
            existingCompositeByKey = lookupResult.byKey;
        }

        // Re-partition composite ready records into "already exists" vs. "to insert".
        const toInsert = [];
        if (isCompositeStrategy) {
            for (const rec of readyRecords) {
                if (rec.key && existingCompositeByKey.has(rec.key)) {
                    stg3Rows.push(makeStg3Row(
                        rec.srcId, sourceObjectName, 'skipped-already-loaded',
                        'Already exists in the target org by composite key',
                        existingCompositeByKey.get(rec.key), ctx.runId, rec.values,
                    ));
                    result.skipped += 1;
                    result.ready -= 1;
                } else {
                    toInsert.push(rec);
                }
            }
        } else {
            toInsert.push(...readyRecords);
        }

        // Bulk INSERT the records (no upsert — tiers 2/3/4 may not be backed by externalId).
        let bulkResults = { successfulResults: [], failedResults: [], unprocessedRecords: [] };
        if (toInsert.length > 0) {
            bulkResults = await bulkIngestService.ingestRecords({
                conn: ctx.conn,
                objectName: targetObjectName,
                operation: 'insert',
                records: toInsert.map((r) => r.values),
            });
        }

        // Reconcile results back to source records.
        // Bulk 2.0 echoes back every input field (including our traceback columns),
        // plus sf__Id on success / sf__Error on failure. Result order is not guaranteed.
        const successById = new Map(); // sourceId-or-compositeKey -> targetId
        const failedByKey = new Map(); // sourceId-or-compositeKey -> error
        const matchCount = new Map();  // key -> count (for ambiguity detection on insert)

        for (const s of bulkResults.successfulResults) {
            const key = isCompositeStrategy
                ? compositeKeyFromValues(s, tracebackColumns)
                : (s[overrideColumn] != null ? String(s[overrideColumn]) : null);
            if (!key) continue;
            matchCount.set(key, (matchCount.get(key) || 0) + 1);
            if (s.sf__Id) successById.set(key, s.sf__Id);
        }
        for (const f of bulkResults.failedResults) {
            const key = isCompositeStrategy
                ? compositeKeyFromValues(f, tracebackColumns)
                : (f[overrideColumn] != null ? String(f[overrideColumn]) : null);
            if (!key) continue;
            failedByKey.set(key, f.sf__Error || 'Unknown error');
        }
        const ambiguousKeys = [...matchCount.entries()].filter(([, n]) => n > 1).map(([k]) => k);
        assertNoAmbiguousMatches(ambiguousKeys, targetObjectName, 'insert reconciliation');

        const unprocessed = Array.isArray(bulkResults.unprocessedRecords) ? bulkResults.unprocessedRecords : [];
        const unprocessedKeys = new Set(unprocessed.map((u) => {
            return isCompositeStrategy
                ? compositeKeyFromValues(u, tracebackColumns)
                : (u?.[overrideColumn] != null ? String(u[overrideColumn]) : null);
        }).filter(Boolean));

        const idMapRows = [];
        for (const rec of toInsert) {
            const key = rec.key;
            if (key && successById.has(key)) {
                const targetId = successById.get(key);
                stg3Rows.push(makeStg3Row(rec.srcId, sourceObjectName, 'loaded', null, targetId, ctx.runId, rec.values));
                result.loaded += 1;
                if (rec.srcId) {
                    idMapRows.push({
                        sourceOrgId: ctx.sourceOrgId,
                        targetOrgId: ctx.targetOrgId,
                        objectName: sourceObjectName,
                        sourceRecordId: String(rec.srcId),
                        targetRecordId: targetId,
                        migrationJobId: null,
                    });
                }
            } else if (key && failedByKey.has(key)) {
                stg3Rows.push(makeStg3Row(rec.srcId, sourceObjectName, 'failed', failedByKey.get(key), null, ctx.runId, rec.values));
                result.failed += 1;
            } else if (key && unprocessedKeys.has(key)) {
                stg3Rows.push(makeStg3Row(rec.srcId, sourceObjectName, 'unprocessed', 'Not processed by Bulk job', null, ctx.runId, rec.values));
                result.failed += 1;
            } else {
                stg3Rows.push(makeStg3Row(rec.srcId, sourceObjectName, 'failed', 'No Bulk result returned for record', null, ctx.runId, rec.values));
                result.failed += 1;
            }
        }

        // Existing-target rows (idempotency) also belong in RecordIdMap.
        if (!isCompositeStrategy) {
            for (const [srcId, targetId] of existingOwnMap) {
                idMapRows.push({
                    sourceOrgId: ctx.sourceOrgId,
                    targetOrgId: ctx.targetOrgId,
                    objectName: sourceObjectName,
                    sourceRecordId: String(srcId),
                    targetRecordId: targetId,
                    migrationJobId: null,
                });
            }
        } else if (existingCompositeByKey.size > 0) {
            // For composite, we need to look up which readyRecord matched which key.
            for (const rec of readyRecords) {
                if (rec.key && existingCompositeByKey.has(rec.key) && rec.srcId) {
                    idMapRows.push({
                        sourceOrgId: ctx.sourceOrgId,
                        targetOrgId: ctx.targetOrgId,
                        objectName: sourceObjectName,
                        sourceRecordId: String(rec.srcId),
                        targetRecordId: existingCompositeByKey.get(rec.key),
                        migrationJobId: null,
                    });
                }
            }
        }

        await insertStg3Rows(stg3Table, stg3Columns, stg3Rows);

        if (idMapRows.length > 0) {
            try {
                await recordIdMapRepository.setTargetIds(idMapRows);
                // Refresh the in-memory id map for this object so children see the new ids.
                ctx.idMaps.delete(sourceObjectName);
            } catch (cacheError) {
                log.error('RecordIdMap cache update failed', cacheError, { targetObjectName, rowCount: idMapRows.length });
                throw cacheError;
            }
        }

        const { successCsv, errorCsv } = await writeObjectCsvs(ctx.loadDir, targetObjectName, stg3Rows);
        result.successCsv = successCsv;
        result.errorCsv = errorCsv;

        result.status = 'success';
        log.info('Object loaded (pass 1)', {
            targetObjectName, strategy, total: result.total, loaded: result.loaded,
            failed: result.failed, skipped: result.skipped,
        });
    } catch (error) {
        if (error instanceof AmbiguousTargetMatchError) {
            // Propagate to abort the whole load.
            throw error;
        }
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

/**
 * SOQL: SELECT Id, fieldName FROM objectName WHERE fieldName IN (values).
 * Throws AmbiguousTargetMatchError if any value matches more than one record.
 */
async function queryTargetIdsByField(conn, { objectName, fieldName, values }) {
    const distinct = uniqueStrings(values);
    const resolved = new Map();
    if (distinct.length === 0 || !fieldName) return resolved;

    const safeObjectName = assertSalesforceApiName(objectName, 'objectName');
    const safeFieldName = assertSalesforceApiName(fieldName, 'fieldName');
    const ambiguous = [];

    for (const chunk of chunkArray(distinct, 200)) {
        const literals = chunk.map((value) => `'${escapeSoqlLiteral(value)}'`).join(', ');
        const soql = `SELECT Id, ${safeFieldName} FROM ${safeObjectName} WHERE ${safeFieldName} IN (${literals})`;
        const result = await conn.query(soql);
        for (const record of result.records || []) {
            const key = record[safeFieldName];
            if (key == null || !record.Id) continue;
            const k = String(key);
            if (resolved.has(k)) {
                ambiguous.push(k);
            } else {
                resolved.set(k, record.Id);
            }
        }
    }
    assertNoAmbiguousMatches(ambiguous, objectName, `field "${fieldName}" pre-existence check`);
    return resolved;
}

/**
 * SOQL: composite tuple lookup. Builds a WHERE clause of OR-of-AND groups,
 *   (F1='v1' AND F2='v2') OR (F1='v3' AND F2='v4') ...
 * chunked to keep query length bounded. Returns:
 *   { byKey: Map<tupleKey, targetId>, ambiguousKeys: string[] }
 */
async function queryTargetIdsByTuples(conn, { objectName, fieldNames, tuples }) {
    const byKey = new Map();
    const ambiguousKeys = [];
    if (!Array.isArray(fieldNames) || fieldNames.length === 0 || tuples.length === 0) {
        return { byKey, ambiguousKeys };
    }

    const safeObjectName = assertSalesforceApiName(objectName, 'objectName');
    const safeFieldNames = fieldNames.map((f) => assertSalesforceApiName(f, 'fieldName'));

    // Dedupe input tuples by their composite key; skip any tuple containing a null.
    const distinctTuples = new Map(); // key -> values[]
    for (const t of tuples) {
        if (!Array.isArray(t) || t.length !== fieldNames.length) continue;
        if (t.some((v) => v === null || v === undefined || String(v) === '')) continue;
        const key = compositeKeyFromArray(t);
        if (!distinctTuples.has(key)) distinctTuples.set(key, t);
    }
    if (distinctTuples.size === 0) return { byKey, ambiguousKeys };

    const entries = [...distinctTuples.entries()];
    // ~25 tuples per query keeps SOQL well under the 100KB limit even for wide field sets.
    const groupSize = Math.max(1, Math.floor(25));
    for (let i = 0; i < entries.length; i += groupSize) {
        const chunk = entries.slice(i, i + groupSize);
        const groups = chunk.map(([, vals]) => {
            const ands = safeFieldNames.map((f, idx) => `${f} = '${escapeSoqlLiteral(vals[idx])}'`).join(' AND ');
            return `(${ands})`;
        });
        const selectFields = ['Id', ...safeFieldNames].join(', ');
        const soql = `SELECT ${selectFields} FROM ${safeObjectName} WHERE ${groups.join(' OR ')}`;
        const result = await conn.query(soql);
        for (const record of result.records || []) {
            const tupleVals = safeFieldNames.map((f) => record[f]);
            if (tupleVals.some((v) => v === null || v === undefined)) continue;
            const key = compositeKeyFromArray(tupleVals);
            if (!record.Id) continue;
            if (byKey.has(key)) ambiguousKeys.push(key);
            else byKey.set(key, record.Id);
        }
    }
    return { byKey, ambiguousKeys };
}

/**
 * Build a stable composite key from a record-like object and a list of field columns.
 * Field values are coerced to strings; nulls become the literal "\0" (unmatchable
 * sentinel) so any null in the tuple cannot collide with real values.
 */
function compositeKeyFromValues(record, fieldColumns) {
    return compositeKeyFromArray(fieldColumns.map((c) => (record?.[c] == null ? null : record[c])));
}

function compositeKeyFromArray(values) {
    return values.map((v) => (v == null ? '\u0000' : String(v).replace(/\u001f/g, ''))).join('\u001f');
}

class AmbiguousTargetMatchError extends Error {
    constructor(message, { objectName, keys, phase }) {
        super(message);
        this.name = 'AmbiguousTargetMatchError';
        this.objectName = objectName;
        this.keys = keys;
        this.phase = phase;
    }
}

function assertNoAmbiguousMatches(keys, objectName, phase) {
    if (!keys || keys.length === 0) return;
    const preview = keys.slice(0, 5).join(', ');
    const more = keys.length > 5 ? ` (+${keys.length - 5} more)` : '';
    throw new AmbiguousTargetMatchError(
        `Load aborted on ${objectName} during ${phase}: ${keys.length} source row(s) matched more than one target record (${preview}${more}). Refine the traceback selection so it uniquely identifies records.`,
        { objectName, keys, phase },
    );
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
