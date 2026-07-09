/**
 * Traceback Service — load correlation strategy + field selection.
 *
 * The user picks HOW source records map back to their target counterparts after
 * a load. We no longer assume a target object has an External Id field. Four
 * tiers are offered, in priority order, and the composite tier is ALWAYS
 * available as a fallback:
 *
 *   T1 'external-id'  : field.externalId && updateable && !autoNumber
 *   T2 'unique'       : field.unique     && updateable && !autoNumber   (and not T1)
 *   T3 'alphanumeric' : textual field (string/textarea/url/email/encryptedstring)
 *                       with length >= 18, updateable, !autoNumber       (and not T1/T2)
 *   T4 'composite'    : any 2+ user-picked target fields — the user is fully
 *                       responsible for choosing a tuple that uniquely
 *                       identifies a target record. No validity check.
 *
 * For tiers 1–3 the loader writes the SOURCE record Id into the chosen field
 * and reconciles after insert via SOQL `WHERE field IN (sourceIds)`. For tier 4
 * the loader inserts user-mapped values as-is and reconciles by tuple match.
 *
 * Selection is stored on `MigrationSetting.metadata.traceback`:
 *   { strategy: 'external-id'|'unique'|'alphanumeric'|'composite',
 *     fields:   [ { id, name }, ... ] }
 *
 * Legacy `metadata.tracebackExternalIdField` is translated on read to
 * `{ strategy:'external-id', fields:[that field] }` and dropped on the next save.
 */

import metadataRepo from '../repositories/metadataRepository.js';
import migrationSettingRepo from '../repositories/migrationSettingRepository.js';
import mappingRepo from '../repositories/mappingRepository.js';
import logger from '../lib/logger.js';

const log = logger.create('tracebackService');

// Textual Salesforce field types that can carry an 18-char alphanumeric Id token.
const ALPHANUMERIC_TYPES = new Set(['string', 'textarea', 'url', 'email', 'encryptedstring']);

const VALID_STRATEGIES = new Set(['external-id', 'unique', 'alphanumeric', 'composite']);

function notAutoNumber(field) {
    return field.autoNumber !== true;
}

function isExternalIdCandidate(field) {
    return field.externalId === true && field.updateable === true && notAutoNumber(field);
}

function isUniqueCandidate(field) {
    return field.unique === true && field.updateable === true && notAutoNumber(field) && !isExternalIdCandidate(field);
}

function isAlphanumericCandidate(field) {
    if (!field.updateable || !notAutoNumber(field)) return false;
    if (isExternalIdCandidate(field) || isUniqueCandidate(field)) return false;
    const type = String(field.type || '').toLowerCase();
    if (!ALPHANUMERIC_TYPES.has(type)) return false;
    return Number(field.length || 0) >= 18;
}

// Tier 4: any user-writable, non-system field is fair game. The user owns
// uniqueness, so we don't filter beyond updateable + !autoNumber.
function isCompositeCandidate(field) {
    if (field.autoNumber === true) return false;
    if (field.updateable !== true) return false;
    return true;
}

function projectField(field, tier) {
    return {
        id: field.id,
        name: field.name,
        label: field.label,
        type: field.type,
        length: field.length ?? null,
        externalId: field.externalId === true,
        unique: field.unique === true,
        tier,
    };
}

/**
 * Build the tiered candidate lists for a target object. The same field never
 * appears in more than one of {external, unique, alphanumeric}; `composite`
 * is independent and may overlap with the others.
 */
async function listTracebackCandidates(targetObjectId) {
    if (!targetObjectId) throw new Error('targetObjectId is required');
    const fields = await metadataRepo.findFieldsByObjectId(targetObjectId);
    const external = [];
    const unique = [];
    const alphanumeric = [];
    const composite = [];
    for (const f of fields) {
        if (isExternalIdCandidate(f)) external.push(projectField(f, 'external-id'));
        else if (isUniqueCandidate(f)) unique.push(projectField(f, 'unique'));
        else if (isAlphanumericCandidate(f)) alphanumeric.push(projectField(f, 'alphanumeric'));
        if (isCompositeCandidate(f)) composite.push(projectField(f, 'composite'));
    }
    const byLabel = (a, b) => String(a.label || a.name).localeCompare(String(b.label || b.name));
    external.sort(byLabel);
    unique.sort(byLabel);
    alphanumeric.sort(byLabel);
    composite.sort(byLabel);
    return { external, unique, alphanumeric, composite };
}

function emptyTraceback() {
    return { strategy: null, fields: [] };
}

function readStoredTraceback(setting) {
    const meta = setting?.metadata || {};
    if (meta.traceback && meta.traceback.strategy && Array.isArray(meta.traceback.fields)) {
        const fields = meta.traceback.fields
            .filter((f) => f && f.id && f.name)
            .map((f) => ({ id: f.id, name: f.name }));
        if (VALID_STRATEGIES.has(meta.traceback.strategy) && fields.length > 0) {
            return { strategy: meta.traceback.strategy, fields };
        }
    }
    // Backward-compat: legacy single-field external-id selection.
    const legacy = meta.tracebackExternalIdField;
    if (legacy && legacy.id && legacy.name) {
        return { strategy: 'external-id', fields: [{ id: legacy.id, name: legacy.name }] };
    }
    return emptyTraceback();
}

/**
 * Read the stored traceback configuration for an object pair.
 * @returns {Promise<{ strategy: string|null, fields: Array<{id,name}> }>}
 */
async function getTraceback(sourceObjectId, targetObjectId) {
    const setting = await migrationSettingRepo.findByObjectPair(sourceObjectId, targetObjectId);
    return readStoredTraceback(setting);
}

async function validateFieldsForStrategy(targetObjectId, strategy, fieldIds) {
    const ids = Array.isArray(fieldIds) ? fieldIds.filter(Boolean) : [];
    if (ids.length === 0) {
        throw new Error('At least one field id is required');
    }
    if (strategy === 'composite') {
        if (ids.length < 2) {
            throw new Error('Composite traceback requires 2 or more fields');
        }
    } else if (ids.length !== 1) {
        throw new Error(`Strategy "${strategy}" requires exactly one field`);
    }

    const fields = [];
    for (const fieldId of ids) {
        const field = await metadataRepo.findFieldById(fieldId);
        if (!field) throw new Error(`Field not found: ${fieldId}`);
        if (field.objectMetadataId !== targetObjectId) {
            throw new Error(`Field ${field.name} does not belong to the target object`);
        }
        if (strategy === 'external-id' && !isExternalIdCandidate(field)) {
            throw new Error(`Field "${field.label || field.name}" is not a valid External Id candidate`);
        }
        if (strategy === 'unique' && !isUniqueCandidate(field)) {
            throw new Error(`Field "${field.label || field.name}" is not a valid Unique candidate`);
        }
        if (strategy === 'alphanumeric' && !isAlphanumericCandidate(field)) {
            throw new Error(`Field "${field.label || field.name}" is not a valid Alphanumeric candidate (textual, length >= 18, updateable)`);
        }
        if (strategy === 'composite' && !isCompositeCandidate(field)) {
            throw new Error(`Field "${field.label || field.name}" cannot be used in a composite key (not updateable or autoNumber)`);
        }
        fields.push({ id: field.id, name: field.name });
    }
    const seen = new Set();
    return fields.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
}

/**
 * Persist (or clear) the traceback configuration.
 *  - `selection = null` (or { strategy: null }) clears the configuration.
 *  - `selection = { strategy, fieldIds }` sets it (validated per strategy).
 *
 * @returns {Promise<{ strategy: string|null, fields: Array<{id,name}> }>}
 */
async function setTraceback(sourceObjectId, targetObjectId, selection) {
    if (!sourceObjectId || !targetObjectId) {
        throw new Error('sourceObjectId and targetObjectId are required');
    }

    let stored = emptyTraceback();
    if (selection && selection.strategy) {
        if (!VALID_STRATEGIES.has(selection.strategy)) {
            throw new Error(`Unknown traceback strategy: ${selection.strategy}`);
        }
        const fields = await validateFieldsForStrategy(targetObjectId, selection.strategy, selection.fieldIds);
        stored = { strategy: selection.strategy, fields };
    }

    const existing = await migrationSettingRepo.findByObjectPair(sourceObjectId, targetObjectId);
    const metadata = { ...(existing?.metadata || {}) };
    if (stored.strategy) metadata.traceback = stored;
    else delete metadata.traceback;
    delete metadata.tracebackExternalIdField;

    await migrationSettingRepo.upsert(sourceObjectId, targetObjectId, { metadata });
    log.info('Traceback configuration saved', {
        sourceObjectId,
        targetObjectId,
        strategy: stored.strategy,
        fields: stored.fields.map((f) => f.name),
    });
    return stored;
}

/**
 * Helper for validation/UI warnings: API names of target fields that are
 * already user-mapped for this object pair. For tiers 1–3 the loader will
 * overwrite the mapped value with the source record Id, so the user should
 * be warned about the conflict.
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
    listTracebackCandidates,
    getTraceback,
    setTraceback,
    getMappedTargetFieldNames,
};
