/**
 * MigrationSetting Service - business logic for per object-pair migration settings
 */

import migrationSettingRepo from '../repositories/migrationSettingRepository.js';
import metadataRepo from '../repositories/metadataRepository.js';
import logger from '../lib/logger.js';

const log = logger.create('migrationSettingService');

const ALLOWED_FIELDS = [
    'enabled',
    'batchSize',
    'useBulkApi',
    'operation',
    'sortToAvoidLocks',
    'extractFilter',
    'externalIdStrategy',
    'metadata',
];

/**
 * Get the migration setting for an object pair, or null if none has been saved yet.
 */
async function getSetting(sourceObjectId, targetObjectId) {
    if (!sourceObjectId || !targetObjectId) {
        throw new Error('Source and target object IDs are required');
    }
    return migrationSettingRepo.findByObjectPair(sourceObjectId, targetObjectId);
}

/**
 * Create or update the migration setting for an object pair.
 */
async function upsertSetting(sourceObjectId, targetObjectId, updates = {}) {
    if (!sourceObjectId || !targetObjectId) {
        throw new Error('Source and target object IDs are required');
    }

    const sourceObject = await metadataRepo.findObjectById(sourceObjectId);
    if (!sourceObject) {
        throw new Error(`Source object not found: ${sourceObjectId}`);
    }
    const targetObject = await metadataRepo.findObjectById(targetObjectId);
    if (!targetObject) {
        throw new Error(`Target object not found: ${targetObjectId}`);
    }

    const fields = {};
    for (const key of ALLOWED_FIELDS) {
        if (updates[key] !== undefined) {
            fields[key] = updates[key];
        }
    }

    const setting = await migrationSettingRepo.upsert(sourceObjectId, targetObjectId, fields);
    log.info('Migration setting saved', { sourceObjectId, targetObjectId, settingId: setting.id });
    return setting;
}

export default {
    getSetting,
    upsertSetting,
};
