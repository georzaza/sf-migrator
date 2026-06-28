/**
 * Traceback Service — load correlation (External Id) field selection.
 *
 * The load (Bulk API 2.0) correlates a source record to its freshly-created
 * target record by writing the SOURCE record Id into an External Id field on
 * the target object and reading it back from the Bulk result files. That field
 * is chosen by the user, per object pair.
 *
 * Rules (see /memories/session/plan-phase-E-pipeline.md "LOAD CORRELATION DECISION"):
 *  - Candidates are TARGET-object fields that are externalId AND createable
 *    (autoNumber / formula fields are not createable, so they can't carry our token).
 *  - The selection is ALWAYS made by the user (we only present candidates).
 *  - With no selection, the object pair is invalid and is not migrated.
 *  - The selection is stored on the MigrationSetting under
 *    metadata.tracebackExternalIdField = { id, name }.
 */

import metadataRepo from '../repositories/metadataRepository.js';
import migrationSettingRepo from '../repositories/migrationSettingRepository.js';
import logger from '../lib/logger.js';

const log = logger.create('tracebackService');

/**
 * Whether a field can serve as a load-correlation External Id field.
 * Must be flagged externalId and be writable on create (createable).
 */
function isExternalIdCandidate(field) {
    return field.externalId === true && field.createable === true;
}

/**
 * List the External Id field candidates for a target object.
 * @returns {Promise<Array<{id, name, label, type, unique}>>}
 */
async function listExternalIdCandidates(targetObjectId) {
    if (!targetObjectId) {
        throw new Error('targetObjectId is required');
    }
    const fields = await metadataRepo.findFieldsByObjectId(targetObjectId);
    return fields
        .filter(isExternalIdCandidate)
        .map((f) => ({
            id: f.id,
            name: f.name,
            label: f.label,
            type: f.type,
            unique: f.unique === true,
        }));
}

/**
 * Return the user-selected External Id field for an object pair, or null.
 * @returns {Promise<{id: string, name: string} | null>}
 */
async function getSelectedExternalIdField(sourceObjectId, targetObjectId) {
    const setting = await migrationSettingRepo.findByObjectPair(sourceObjectId, targetObjectId);
    const selected = setting?.metadata?.tracebackExternalIdField;
    if (selected && selected.id && selected.name) {
        return { id: selected.id, name: selected.name };
    }
    return null;
}

/**
 * Select (or clear) the External Id field used for load correlation on an object pair.
 * Passing a falsy fieldId clears the selection.
 * @returns {Promise<{id: string, name: string} | null>} the stored selection
 */
async function setExternalIdField(sourceObjectId, targetObjectId, fieldId) {
    if (!sourceObjectId || !targetObjectId) {
        throw new Error('sourceObjectId and targetObjectId are required');
    }

    let selection = null;
    if (fieldId) {
        const field = await metadataRepo.findFieldById(fieldId);
        if (!field) {
            throw new Error(`Field not found: ${fieldId}`);
        }
        if (field.objectMetadataId !== targetObjectId) {
            throw new Error('Selected External Id field does not belong to the target object');
        }
        if (!isExternalIdCandidate(field)) {
            throw new Error(`Field "${field.label || field.name}" is not a usable External Id field (must be an External Id and writable on create)`);
        }
        selection = { id: field.id, name: field.name };
    }

    // Merge into the existing metadata so other keys are preserved.
    const existing = await migrationSettingRepo.findByObjectPair(sourceObjectId, targetObjectId);
    const metadata = { ...(existing?.metadata || {}), tracebackExternalIdField: selection };

    await migrationSettingRepo.upsert(sourceObjectId, targetObjectId, { metadata });
    log.info('Traceback External Id field set', { sourceObjectId, targetObjectId, field: selection?.name || null });
    return selection;
}

export default {
    listExternalIdCandidates,
    getSelectedExternalIdField,
    setExternalIdField,
};
