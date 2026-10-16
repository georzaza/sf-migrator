/**
 * MigrationSetting Service - business logic for per object-pair migration settings
 */

import migrationSettingRepo from '../repositories/migrationSettingRepository.js';
import metadataRepo from '../repositories/metadataRepository.js';
import logger from '../lib/logger.js';
import tracebackService from './tracebackService.js';

const log = logger.create('migrationSettingService');

const ALLOWED_FIELDS = [
    'batchSize',
    'sortToAvoidLocks',
    'operation',
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
 * Return a normalized map of effective per-object-pair settings for an org pair.
 * Default behavior (no row) is `{ enabled: true }`.
 *
 * @returns {Promise<Map<string, Map<string, { enabled: boolean }>>>}
 *   outer key  = sourceObjectId
 *   inner key  = targetObjectId
 */
async function getEffectiveSettingsMap(sourceOrgId, targetOrgId) {
    const out = new Map();
    if (!sourceOrgId || !targetOrgId) return out;
    const rows = await migrationSettingRepo.findAllByOrgPair(sourceOrgId, targetOrgId);
    for (const row of rows) {
        if (!out.has(row.sourceObjectId)) out.set(row.sourceObjectId, new Map());
        out.get(row.sourceObjectId).set(row.targetObjectId, {
            referenceResolution: row.metadata?.referenceResolution || { strategy: 'id-map' },
        });
    }
    return out;
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

    const resolution = updates.referenceResolution !== undefined ? updates.referenceResolution : updates.metadata?.referenceResolution;
    if (resolution !== undefined) {
        const referenceResolution = await tracebackService.validateReferenceFields(sourceObjectId, targetObjectId, resolution);
        const existing = await migrationSettingRepo.findByObjectPair(sourceObjectId, targetObjectId);
        fields.metadata = { ...(existing?.metadata || {}), ...(fields.metadata || {}), referenceResolution };
    }

    const setting = await migrationSettingRepo.upsert(sourceObjectId, targetObjectId, fields);
    // log.info('Migration setting saved', { sourceObjectId, targetObjectId, settingId: setting.id });
    return setting;
}

async function getReferenceResolutions(sourceOrgId, targetOrgId = null) {
    const rows = await migrationSettingRepo.findAllByOrgPair(sourceOrgId, targetOrgId);
    return rows.filter((row) => row.metadata?.referenceResolution?.strategy === 'match-existing');
}

export default {
    getSetting,
    upsertSetting,
    getEffectiveSettingsMap,
    getReferenceResolutions,
};
