/**
 * Upsert Key Service — External ID field selection for upsert operations.
 *
 * The user selects a target External ID field that will serve as the upsert key
 * during migration. The Salesforce Bulk API 2.0 upsert operation uses this field
 * to match existing records (update) or create new ones (insert).
 *
 * Requirements:
 *  - Field must be a Salesforce External ID field (externalId === true)
 *  - Field must be updateable and not auto-number
 *  - Field must be user-mapped (source field → target external ID field)
 *
 * Selection is stored on `MigrationSetting.metadata.upsertExternalId`:
 *   { id: fieldId, name: apiName }
 *
 * The migration operation ('insert' | 'upsert') is stored separately on
 * `MigrationSetting.metadata.operation` (defaults to 'upsert').
 */

import metadataRepo from '../repositories/metadataRepository.js';
import migrationSettingRepo from '../repositories/migrationSettingRepository.js';
import mappingRepo from '../repositories/mappingRepository.js';
import logger from '../lib/logger.js';

const log = logger.create('upsertKeyService');

function isExternalIdCandidate(field) {
    return field.externalId === true && field.updateable === true && field.autoNumber !== true;
}

function projectField(field) {
    return {
        id: field.id,
        name: field.name,
        label: field.label,
        type: field.type,
        externalId: field.externalId === true,
    };
}

/**
 * List all External ID fields available on a target object.
 */
async function listExternalIdCandidates(targetObjectId) {
    if (!targetObjectId) throw new Error('targetObjectId is required');
    const fields = await metadataRepo.findFieldsByObjectId(targetObjectId);
    const candidates = [];
    for (const f of fields) {
        if (isExternalIdCandidate(f)) {
            candidates.push(projectField(f));
        }
    }
    const byLabel = (a, b) => String(a.label || a.name).localeCompare(String(b.label || b.name));
    candidates.sort(byLabel);
    return candidates;
}

function readStoredUpsertKey(setting) {
    const meta = setting?.metadata || {};

    // New format: metadata.upsertExternalId
    if (meta.upsertExternalId && meta.upsertExternalId.id && meta.upsertExternalId.name) {
        return { id: meta.upsertExternalId.id, name: meta.upsertExternalId.name };
    }

    // Legacy: migrate from old traceback format (external-id strategy only)
    if (meta.traceback?.strategy === 'external-id' && meta.traceback.fields?.[0]) {
        const field = meta.traceback.fields[0];
        if (field.id && field.name) {
            return { id: field.id, name: field.name };
        }
    }

    // Legacy: metadata.tracebackExternalIdField
    if (meta.tracebackExternalIdField && meta.tracebackExternalIdField.id && meta.tracebackExternalIdField.name) {
        return { id: meta.tracebackExternalIdField.id, name: meta.tracebackExternalIdField.name };
    }

    return null;
}

function readStoredOperation(setting) {
    // operation is a proper DB column on MigrationSetting, not stored in metadata.
    // Default to 'upsert' if not set.
    const operation = setting?.operation || 'upsert';
    return ['insert', 'upsert'].includes(operation) ? operation : 'upsert';
}

/**
 * Read the stored upsert External ID configuration and operation for an object pair.
 * @returns {Promise<{ upsertExternalId: {id, name}|null, operation: 'insert'|'upsert' }>}
 */
async function getUpsertConfig(sourceObjectId, targetObjectId) {
    const setting = await migrationSettingRepo.findByObjectPair(sourceObjectId, targetObjectId);
    return {
        upsertExternalId: readStoredUpsertKey(setting),
        operation: readStoredOperation(setting),
    };
}

/**
 * Set the upsert External ID field for an object pair.
 * @param {string|number} sourceObjectId
 * @param {string|number} targetObjectId
 * @param {string|number|null} fieldId - External ID field id, or null to clear
 * @returns {Promise<{id, name}|null>}
 */
async function setUpsertExternalId(sourceObjectId, targetObjectId, fieldId) {
    if (!sourceObjectId || !targetObjectId) {
        throw new Error('sourceObjectId and targetObjectId are required');
    }

    let upsertExternalId = null;

    if (fieldId) {
        const field = await metadataRepo.findFieldById(fieldId);
        if (!field) throw new Error(`Field not found: ${fieldId}`);
        if (field.objectMetadataId !== targetObjectId) {
            throw new Error(`Field ${field.name} does not belong to the target object`);
        }
        if (!isExternalIdCandidate(field)) {
            throw new Error(`Field "${field.label || field.name}" is not a valid External ID (must be externalId=true, updateable, and not auto-number)`);
        }
        upsertExternalId = { id: field.id, name: field.name };
    }

    const existing = await migrationSettingRepo.findByObjectPair(sourceObjectId, targetObjectId);
    const metadata = { ...(existing?.metadata || {}) };

    if (upsertExternalId) {
        metadata.upsertExternalId = upsertExternalId;
    } else {
        delete metadata.upsertExternalId;
    }

    // Clean up legacy fields
    delete metadata.traceback;
    delete metadata.tracebackExternalIdField;

    await migrationSettingRepo.upsert(sourceObjectId, targetObjectId, { metadata });
    log.info('Upsert External ID saved', {
        sourceObjectId,
        targetObjectId,
        fieldName: upsertExternalId?.name || null,
    });
    return upsertExternalId;
}

/**
 * Set the operation type for an object pair.
 * @param {string|number} sourceObjectId
 * @param {string|number} targetObjectId
 * @param {'insert'|'upsert'} operation
 * @returns {Promise<'insert'|'upsert'>}
 */
async function setOperation(sourceObjectId, targetObjectId, operation) {
    if (!sourceObjectId || !targetObjectId) {
        throw new Error('sourceObjectId and targetObjectId are required');
    }
    if (!['insert', 'upsert'].includes(operation)) {
        throw new Error(`Invalid operation: ${operation}. Must be 'insert' or 'upsert'.`);
    }

    // operation is a proper DB column on MigrationSetting.
    await migrationSettingRepo.upsert(sourceObjectId, targetObjectId, { operation });
    log.info('Operation saved', { sourceObjectId, targetObjectId, operation });
    return operation;
}

/**
 * Check if the selected upsert External ID field is mapped.
 * @returns {Promise<boolean>} - true if the field is mapped, false otherwise
 */
async function isUpsertExternalIdMapped(sourceObjectId, targetObjectId, externalIdFieldName) {
    if (!externalIdFieldName) return false;
    const mappings = await mappingRepo.findFieldMappingsByObjectPair(sourceObjectId, targetObjectId);
    return mappings.some((m) => m.targetField?.name === externalIdFieldName);
}

/**
 * Helper for validation/UI warnings: API names of target fields that are
 * already user-mapped for this object pair.
 * @returns {Promise<Set<string>>}
 */
async function getMappedTargetFieldNames(sourceObjectId, targetObjectId) {
    const mappings = await mappingRepo.findFieldMappingsByObjectPair(sourceObjectId, targetObjectId);
    return new Set(
        mappings
            .map((m) => m.targetField?.name)
            .filter(Boolean),
    );
}

export default {
    listExternalIdCandidates,
    getUpsertConfig,
    setUpsertExternalId,
    setOperation,
    isUpsertExternalIdMapped,
    getMappedTargetFieldNames,
};
