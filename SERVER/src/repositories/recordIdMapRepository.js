/**
 * RecordIdMap Repository - persistence for source -> target record Id mapping
 */

import db from '../../models/index.js';
import logger from '../lib/logger.js';

const { RecordIdMap } = db;
const log = logger.create('recordIdMapRepository');

/**
 * Insert source record keys without overwriting any existing target Id.
 * Rows already present (same source key) are left untouched.
 * @param {Array<{sourceOrgId,targetOrgId,objectName,sourceRecordId}>} rows
 */
async function upsertSourceKeys(rows) {
    if (!rows || rows.length === 0) return [];
    const created = await RecordIdMap.bulkCreate(rows, {
        ignoreDuplicates: true,
    });
    log.info('Upserted source record keys', { requested: rows.length, inserted: created.length });
    return created;
}

/**
 * Set (or create) the target record Id for a single source key.
 */
async function setTargetId({ sourceOrgId, targetOrgId, objectName, sourceRecordId, targetRecordId, migrationJobId = null }) {
    const [row, created] = await RecordIdMap.findOrCreate({
        where: { sourceOrgId, targetOrgId, objectName, sourceRecordId },
        defaults: { sourceOrgId, targetOrgId, objectName, sourceRecordId, targetRecordId, migrationJobId },
    });

    if (!created) {
        await row.update({ targetRecordId, migrationJobId });
    }
    return row;
}

/**
 * Resolve the target record Id for a source key. Returns null if unknown or not yet loaded.
 */
async function resolveTargetId({ sourceOrgId, targetOrgId, objectName, sourceRecordId }) {
    const row = await RecordIdMap.findOne({
        where: { sourceOrgId, targetOrgId, objectName, sourceRecordId },
    });
    return row?.targetRecordId || null;
}

/**
 * Return all id-map rows for a single object in an org pair.
 * @returns {Promise<Array<{sourceRecordId: string, targetRecordId: string|null}>>}
 */
async function findByObject({ sourceOrgId, targetOrgId, objectName }) {
    const rows = await RecordIdMap.findAll({
        where: { sourceOrgId, targetOrgId, objectName },
        attributes: ['sourceRecordId', 'targetRecordId'],
    });
    return rows.map((r) => ({ sourceRecordId: r.sourceRecordId, targetRecordId: r.targetRecordId }));
}

/**
 * Bulk insert/update target record Ids for many source keys at once.
 * Existing rows (same source key) have their targetRecordId / migrationJobId updated.
 * @param {Array<{sourceOrgId,targetOrgId,objectName,sourceRecordId,targetRecordId,migrationJobId}>} rows
 */
async function setTargetIds(rows) {
    if (!rows || rows.length === 0) return [];
    const result = await RecordIdMap.bulkCreate(rows, {
        updateOnDuplicate: ['targetRecordId', 'migrationJobId'],
        conflictAttributes: ['sourceOrgId', 'targetOrgId', 'objectName', 'sourceRecordId'],
    });
    log.info('Bulk set target record Ids', { count: result.length });
    return result;
}

export default {
    upsertSourceKeys,
    setTargetId,
    setTargetIds,
    resolveTargetId,
    findByObject,
};
