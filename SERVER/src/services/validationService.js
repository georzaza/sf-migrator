/**
 * Validation Service - Field mapping and object mapping validation
 *
 * Blocking rules throw an Error (surfaced to the caller as a failure).
 * Non-blocking rules are returned as a `warnings` array so the UI can show
 * advisory messages without preventing the user from saving.
 *
 * NOTE: Salesforce field-level security (FLS) is not stored in our metadata.
 * Per product decision, the `updateable` flag is used as the write-access
 * proxy for target fields (this also naturally excludes formula, roll-up,
 * and auto-number fields, which are never updateable).
 */

import mappingRepo from '../repositories/mappingRepository.js';
import metadataRepo from '../repositories/metadataRepository.js';
import relationshipResolver from './relationshipResolver.js';
import tracebackService from './tracebackService.js';
import logger from '../lib/logger.js';

const log = logger.create('validationService');

/**
 * Coarse type groups used for advisory type-compatibility warnings.
 * Text-like targets can accept almost anything, so they never warn.
 */
const TYPE_GROUPS = {
    string: 'text', textarea: 'text', picklist: 'text', multipicklist: 'text',
    phone: 'text', url: 'text', email: 'text', encryptedstring: 'text',
    combobox: 'text', id: 'text', reference: 'text',
    int: 'number', double: 'number', currency: 'number', percent: 'number', long: 'number',
    date: 'date', datetime: 'date', time: 'date',
    boolean: 'boolean',
};

function typeGroup(type) {
    return TYPE_GROUPS[String(type || '').toLowerCase()] || 'other';
}

/**
 * Advisory only. Returns false when the source and target types are unlikely
 * to be compatible. Text-like targets always accept the value.
 */
function typesCompatible(sourceType, targetType) {
    if (!sourceType || !targetType) return true;
    if (String(sourceType).toLowerCase() === String(targetType).toLowerCase()) return true;
    const targetGroup = typeGroup(targetType);
    if (targetGroup === 'text') return true;
    return typeGroup(sourceType) === targetGroup;
}

/**
 * Validate a single field mapping before it is created or updated.
 *
 * @param {object} input
 * @param {string} input.sourceObjectId
 * @param {string} input.targetObjectId
 * @param {string} [input.sourceFieldId]
 * @param {string} input.targetFieldId
 * @param {string} [input.mappingType]      'as-is' | 'expression' | 'constant'
 * @param {string} [input.transformationRule] expression rule (for 'expression' mappings)
 * @param {string} [input.excludeMappingId] mapping id to ignore in the
 *                                           "already mapped" check (used on update)
 * @returns {Promise<{ warnings: Array<{ code: string, message: string }> }>}
 */
async function validateFieldMapping(input) {
    const {
        sourceObjectId,
        targetObjectId,
        sourceFieldId,
        targetFieldId,
        mappingType = 'as-is',
        transformationRule = null,
        excludeMappingId = null,
    } = input;

    const warnings = [];

    const targetField = await metadataRepo.findFieldById(targetFieldId);
    if (!targetField) {
        throw new Error(`Target field not found: ${targetFieldId}`);
    }

    // BLOCK: target field must be writable. `updateable` is the write-access
    // proxy and excludes formula / roll-up / auto-number fields.
    if (targetField.updateable === false) {
        throw new Error(`Target field is read-only and cannot be migrated: ${targetField.label || targetField.name}`);
    }

    // BLOCK: the target field must not already be mapped from any source
    // (one mapping per target field on a given target object).
    const existingForTarget = await mappingRepo.findFieldMappingsByTargetField(targetObjectId, targetFieldId);
    const conflicting = existingForTarget.filter((m) => m.id !== excludeMappingId);
    if (conflicting.length > 0) {
        throw new Error(`Target field is already mapped: ${targetField.label || targetField.name}`);
    }

    // WARN: advisory type compatibility, only meaningful for as-is mappings.
    if (mappingType === 'as-is' && sourceFieldId) {
        const sourceField = await metadataRepo.findFieldById(sourceFieldId);
        if (sourceField && !typesCompatible(sourceField.type, targetField.type)) {
            warnings.push({
                code: 'type-incompatible',
                message: `Source type "${sourceField.type}" may not be compatible with target type "${targetField.type}".`,
            });
        }
    }

    // BLOCK/WARN: for expression mappings, validate that every referenced field
    // path exists (traversing relationships). Missing relationships/fields throw;
    // unresolvable (not-yet-analyzed) objects produce advisory warnings.
    if (mappingType === 'expression' && transformationRule) {
        const sourceObject = await metadataRepo.findObjectById(sourceObjectId);
        if (sourceObject) {
            const { warnings: refWarnings } = await relationshipResolver.validateTransformationReferences(
                sourceObject.sfOrgId,
                transformationRule,
            );
            warnings.push(...refWarnings);
        }
    }

    log.debug('Field mapping validated', {
        sourceObjectId,
        targetObjectId,
        targetFieldId,
        warningCount: warnings.length,
    });

    return { warnings };
}

/**
 * Object-level validation. Returns advisory warnings for required target
 * fields that have no mapping yet. A target field is treated as required when
 * it is createable, not nillable, and has no default value.
 *
 * @param {string} sourceObjectId
 * @param {string} targetObjectId
 * @returns {Promise<{ warnings: Array<{ code: string, field: string, message: string }> }>}
 */
async function validateObjectMapping(sourceObjectId, targetObjectId) {
    const warnings = [];

    const targetFields = await metadataRepo.findFieldsByObjectId(targetObjectId);
    const mappings = await mappingRepo.findFieldMappingsByObjectPair(sourceObjectId, targetObjectId);
    const mappedTargetFieldIds = new Set(mappings.map((m) => m.targetFieldId));

    for (const field of targetFields) {
        const isRequired =
            field.createable === true &&
            field.nillable === false &&
            !field.defaultedOnCreate &&
            field.defaultValue == null;

        if (isRequired && !mappedTargetFieldIds.has(field.id)) {
            warnings.push({
                code: 'required-unmapped',
                field: field.name,
                message: `Required target field is not mapped: ${field.label || field.name}`,
            });
        }
    }

    // BLOCK (load): a load-correlation traceback must be configured, otherwise
    // source records cannot be matched to their created target records and the
    // object is not migrated.
    const selectedTraceback = await tracebackService.getTraceback(sourceObjectId, targetObjectId);
    if (!selectedTraceback.strategy) {
        const candidates = await tracebackService.listTracebackCandidates(targetObjectId);
        const hints = [];
        if (candidates.external.length) hints.push(`External Id: ${candidates.external.map((c) => c.label || c.name).join(', ')}`);
        if (candidates.unique.length) hints.push(`Unique: ${candidates.unique.map((c) => c.label || c.name).join(', ')}`);
        if (candidates.alphanumeric.length) hints.push(`Alphanumeric (length >= 18): ${candidates.alphanumeric.map((c) => c.label || c.name).join(', ')}`);
        warnings.push({
            code: 'no-traceback-field',
            message: hints.length > 0
                ? `No traceback configured. Pick a single field — ${hints.join(' | ')} — or a combination of fields (composite). Until then, this object will not be migrated.`
                : `No traceback configured. Pick a combination of fields (composite) that uniquely identifies records on the target. Until then, this object will not be migrated.`,
        });
    } else if (selectedTraceback.strategy !== 'composite' && selectedTraceback.fields[0]) {
        // ADVISORY: for tier 1–3 strategies, warn if the chosen field is also
        // user-mapped — the loader will overwrite the mapped value with the
        // source record Id.
        const mappedNames = await tracebackService.getMappedTargetFieldNames(sourceObjectId, targetObjectId);
        const tracebackName = selectedTraceback.fields[0].name;
        if (mappedNames.has(tracebackName)) {
            warnings.push({
                code: 'traceback-field-overrides-mapping',
                field: tracebackName,
                message: `Field "${tracebackName}" is both the traceback field and a user-mapped target field. The user mapping will be overridden with the source record Id during load.`,
            });
        }
    }

    log.debug('Object mapping validated', {
        sourceObjectId,
        targetObjectId,
        warningCount: warnings.length,
    });

    return { warnings };
}

export default {
    validateFieldMapping,
    validateObjectMapping,
};
