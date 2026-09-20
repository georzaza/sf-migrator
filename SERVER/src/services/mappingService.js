/**
 * Mapping Service - Business logic for field mappings
 */

import mappingRepo from '../repositories/mappingRepository.js';
import metadataRepo from '../repositories/metadataRepository.js';
import validationService from './validationService.js';
import logger from '../lib/logger.js';
import { parseTransformationRule } from '../utils/transformationRule.js';

const log = logger.create('mappingService');

/**
 * Get all mappings for a source org (grouped by source/target object pair)
 */
async function getObjectMappingsBySourceOrg(sourceOrgId) {
    const fieldMappings = await mappingRepo.findFieldMappingsBySourceOrg(sourceOrgId);
    return buildObjectPairSummaries(fieldMappings);
}

/**
 * Get all mappings for a specific org pair (grouped by source/target object pair)
 */
async function getObjectMappingsByOrgPair(sourceOrgId, targetOrgId) {
    const fieldMappings = await mappingRepo.findFieldMappingsByOrgPair(sourceOrgId, targetOrgId);
    return buildObjectPairSummaries(fieldMappings);
}

async function getFieldMappingsBySourceOrg(sourceOrgId) {
    return mappingRepo.findFieldMappingsBySourceOrg(sourceOrgId);
}

async function getFieldMappingsByOrgPair(sourceOrgId, targetOrgId) {
    return mappingRepo.findFieldMappingsByOrgPair(sourceOrgId, targetOrgId);
}

/**
 * Get all mappings that point into a specific target org (grouped by source/target object pair)
 */
async function getObjectMappingsByTargetOrg(targetOrgId) {
    const fieldMappings = await mappingRepo.findFieldMappingsByTargetOrg(targetOrgId);
    return buildObjectPairSummaries(fieldMappings);
}

/**
 * Create or upsert a logical object mapping (derived from field mappings).
 */
async function upsertObjectMapping(sourceObjectId, targetObjectId) {
    const sourceObject = await metadataRepo.findObjectById(sourceObjectId);
    const targetObject = await metadataRepo.findObjectById(targetObjectId);

    if (!sourceObject) {
        throw new Error(`Source object not found: ${sourceObjectId}`);
    }
    if (!targetObject) {
        throw new Error(`Target object not found: ${targetObjectId}`);
    }

    const pseudoId = `${sourceObjectId}:${targetObjectId}`;
    log.info('Object mapping pair validated', { sourceObjectId, targetObjectId });
    return {
        id: pseudoId,
        sourceObjectId,
        targetObjectId,
        sourceObject,
        targetObject,
        fieldMappingCount: 0,
    };
}

/**
 * Update object mapping properties.
 * Removed with FieldMapping-only architecture.
 */
async function updateObjectMapping(mappingId, updates) {
    throw new Error('Object mappings are no longer persisted. Update field mappings instead.');
}

/**
 * Delete all field mappings for an object pair
 */
async function deleteObjectMapping(mappingId) {
    const [sourceObjectId, targetObjectId] = String(mappingId).split(':');
    if (!sourceObjectId || !targetObjectId) {
        throw new Error('Invalid mapping ID format');
    }
    return await mappingRepo.bulkDeleteFieldMappings(sourceObjectId, targetObjectId);
}

/**
 * Get all field mappings for a source/target object pair
 */
async function getFieldMappingsByObjectMapping(mappingId) {
    const [sourceObjectId, targetObjectId] = String(mappingId).split(':');
    if (!sourceObjectId || !targetObjectId) {
        throw new Error('Invalid mapping ID format');
    }
    return await mappingRepo.findFieldMappingsByObjectPair(sourceObjectId, targetObjectId);
}

/**
 * Create a field mapping
 */
async function createFieldMapping(data) {
    const { sourceObjectId, targetObjectId, sourceFieldId, targetFieldId, mappingType, transformationRule, constantValue } = data;

    const sourceObject = await metadataRepo.findObjectById(sourceObjectId);
    const targetObject = await metadataRepo.findObjectById(targetObjectId);
    if (!sourceObject) {
        throw new Error(`Source object not found: ${sourceObjectId}`);
    }
    if (!targetObject) {
        throw new Error(`Target object not found: ${targetObjectId}`);
    }

    // Validate target field exists
    const targetField = await metadataRepo.findFieldById(targetFieldId);
    if (!targetField) {
        throw new Error(`Target field not found: ${targetFieldId}`);
    }

    // For as-is mapping, validate source field
    if (mappingType === 'as-is') {
        if (!sourceFieldId) {
            throw new Error('Source field is required for as-is mapping');
        }
        const sourceField = await metadataRepo.findFieldById(sourceFieldId);
        if (!sourceField) {
            throw new Error(`Source field not found: ${sourceFieldId}`);
        }
    }

    // For expression mapping, require transformationRule and validate grammar
    if (mappingType === 'expression' && !transformationRule) {
        throw new Error('Transformation rule is required for expression mapping');
    }
    if (mappingType === 'expression') {
        parseTransformationRule(transformationRule);
    }

    // For constant mapping, require constantValue
    if (mappingType === 'constant' && !constantValue) {
        throw new Error('Constant value is required for constant mapping');
    }

    // Run mapping validation (throws on blocking rules, returns advisory warnings)
    const { warnings } = await validationService.validateFieldMapping({
        sourceObjectId,
        targetObjectId,
        sourceFieldId,
        targetFieldId,
        mappingType,
        transformationRule,
    });

    // Create the field mapping
    const mapping = await mappingRepo.createFieldMapping({
        sourceObjectId,
        targetObjectId,
        sourceFieldId: sourceFieldId || null,
        targetFieldId,
        mappingType,
        transformationRule: transformationRule || null,
        constantValue: constantValue || null,
    });

    log.info('Field mapping created', { mappingId: mapping.id, sourceObjectId, targetObjectId });

    const result = mapping.toJSON();
    result.warnings = warnings;
    return result;
}

/**
 * Update a field mapping
 */
async function updateFieldMapping(mappingId, updates) {
    // Get existing mapping
    const existing = await mappingRepo.findFieldMappingById(mappingId);
    if (!existing) {
        throw new Error(`Field mapping not found: ${mappingId}`);
    }

    const allowedFields = ['sourceObjectId', 'targetObjectId', 'sourceFieldId', 'targetFieldId', 'mappingType', 'transformationRule', 'constantValue'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
        }
    }

    if (filteredUpdates.mappingType === 'expression' && !filteredUpdates.transformationRule && !existing.transformationRule) {
        throw new Error('Transformation rule is required for expression mapping');
    }

    if (filteredUpdates.mappingType === 'expression' || (filteredUpdates.transformationRule && (filteredUpdates.mappingType || existing.mappingType) === 'expression')) {
        parseTransformationRule(filteredUpdates.transformationRule || existing.transformationRule);
    }

    // Run mapping validation against the effective (post-update) values.
    const effective = {
        sourceObjectId: filteredUpdates.sourceObjectId ?? existing.sourceObjectId,
        targetObjectId: filteredUpdates.targetObjectId ?? existing.targetObjectId,
        sourceFieldId: filteredUpdates.sourceFieldId ?? existing.sourceFieldId,
        targetFieldId: filteredUpdates.targetFieldId ?? existing.targetFieldId,
        mappingType: filteredUpdates.mappingType ?? existing.mappingType,
        transformationRule: filteredUpdates.transformationRule ?? existing.transformationRule,
        excludeMappingId: mappingId,
    };
    const { warnings } = await validationService.validateFieldMapping(effective);

    const mapping = await mappingRepo.updateFieldMapping(mappingId, filteredUpdates);
    const result = mapping.toJSON();
    result.warnings = warnings;
    return result;
}

/**
 * Delete a field mapping
 */
async function deleteFieldMapping(mappingId) {
    // Get existing mapping
    const existing = await mappingRepo.findFieldMappingById(mappingId);
    if (!existing) {
        throw new Error(`Field mapping not found: ${mappingId}`);
    }

    return await mappingRepo.deleteFieldMapping(mappingId);
}

/**
 * Export all field mappings for an org pair as CSV rows.
 * Columns: sourceObject, sourceField, mappingType, targetObject, targetField,
 *          transformationRule, constantValue
 */
async function exportMappingsCsv(sourceOrgId, targetOrgId) {
    const mappings = await mappingRepo.findFieldMappingsByOrgPair(sourceOrgId, targetOrgId);

    const headers = ['sourceObject', 'sourceField', 'mappingType', 'targetObject', 'targetField', 'transformationRule', 'constantValue'];

    const rows = mappings.map((m) => [
        m.sourceObject?.name ?? '',
        m.sourceField?.name ?? '',
        m.mappingType ?? '',
        m.targetObject?.name ?? '',
        m.targetField?.name ?? '',
        m.transformationRule ?? '',
        m.constantValue ?? '',
    ]);

    return [headers, ...rows]
        .map((row) => row.map(csvEscape).join(','))
        .join('\r\n');
}

function csvEscape(value) {
    const s = String(value ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Import field mappings from parsed CSV rows (array of objects with header keys).
 * Skips rows with missing required fields. Returns { created, skipped, errors }.
 */
async function importMappingsCsv(sourceOrgId, targetOrgId, rows) {
    if (!sourceOrgId || !targetOrgId) throw new Error('sourceOrgId and targetOrgId are required');

    // Pre-load all object/field metadata for fast lookup
    const sourceObjects = await metadataRepo.findObjectsByOrgId(sourceOrgId);
    const targetObjects = await metadataRepo.findObjectsByOrgId(targetOrgId);

    const sourceObjByName = new Map(sourceObjects.map((o) => [o.name, o]));
    const targetObjByName = new Map(targetObjects.map((o) => [o.name, o]));

    // Cache fields per object (loaded on demand)
    const sourceFieldsCache = new Map(); // objectId -> Map(fieldName -> field)
    const targetFieldsCache = new Map();

    async function getSourceFields(objectId) {
        if (!sourceFieldsCache.has(objectId)) {
            const fields = await metadataRepo.findFieldsByObjectId(objectId);
            sourceFieldsCache.set(objectId, new Map(fields.map((f) => [f.name, f])));
        }
        return sourceFieldsCache.get(objectId);
    }

    async function getTargetFields(objectId) {
        if (!targetFieldsCache.has(objectId)) {
            const fields = await metadataRepo.findFieldsByObjectId(objectId);
            targetFieldsCache.set(objectId, new Map(fields.map((f) => [f.name, f])));
        }
        return targetFieldsCache.get(objectId);
    }

    let created = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // 1-based, +1 for header

        const sourceObjectName = String(row.sourceObject ?? '').trim();
        const sourceFieldName = String(row.sourceField ?? '').trim();
        const mappingType = String(row.mappingType ?? '').trim();
        const targetObjectName = String(row.targetObject ?? '').trim();
        const targetFieldName = String(row.targetField ?? '').trim();
        const transformationRule = String(row.transformationRule ?? '').trim() || null;
        const constantValue = String(row.constantValue ?? '').trim() || null;

        if (!targetObjectName || !targetFieldName || !mappingType) {
            errors.push(`Row ${rowNum}: missing targetObject, targetField, or mappingType`);
            skipped++;
            continue;
        }

        if (!['as-is', 'expression', 'constant'].includes(mappingType)) {
            errors.push(`Row ${rowNum}: invalid mappingType "${mappingType}"`);
            skipped++;
            continue;
        }

        const sourceObj = sourceObjectName ? sourceObjByName.get(sourceObjectName) : null;
        const targetObj = targetObjByName.get(targetObjectName);

        if (!targetObj) {
            errors.push(`Row ${rowNum}: target object "${targetObjectName}" not found`);
            skipped++;
            continue;
        }
        if (mappingType === 'as-is' && !sourceObj) {
            errors.push(`Row ${rowNum}: source object "${sourceObjectName}" not found (required for as-is mapping)`);
            skipped++;
            continue;
        }

        const targetFieldMap = await getTargetFields(targetObj.id);
        const targetField = targetFieldMap.get(targetFieldName);
        if (!targetField) {
            errors.push(`Row ${rowNum}: target field "${targetFieldName}" not found on "${targetObjectName}"`);
            skipped++;
            continue;
        }

        let sourceFieldId = null;
        if (mappingType === 'as-is' && sourceFieldName) {
            const sourceFieldMap = await getSourceFields(sourceObj.id);
            const sourceField = sourceFieldMap.get(sourceFieldName);
            if (!sourceField) {
                errors.push(`Row ${rowNum}: source field "${sourceFieldName}" not found on "${sourceObjectName}"`);
                skipped++;
                continue;
            }
            sourceFieldId = sourceField.id;
        }

        try {
            await createFieldMapping({
                sourceObjectId: sourceObj?.id ?? null,
                targetObjectId: targetObj.id,
                sourceFieldId,
                targetFieldId: targetField.id,
                mappingType,
                transformationRule,
                constantValue,
            });
            created++;
        } catch (err) {
            errors.push(`Row ${rowNum}: ${err.message}`);
            skipped++;
        }
    }

    return { created, skipped, errors };
}

export default {
    getObjectMappingsBySourceOrg,
    getObjectMappingsByOrgPair,
    getObjectMappingsByTargetOrg,
    getFieldMappingsBySourceOrg,
    getFieldMappingsByOrgPair,
    upsertObjectMapping,
    updateObjectMapping,
    deleteObjectMapping,

    // Field mapping methods
    getFieldMappingsByObjectMapping,
    createFieldMapping,
    updateFieldMapping,
    deleteFieldMapping,

    // CSV export/import
    exportMappingsCsv,
    importMappingsCsv,
};

function buildObjectPairSummaries(fieldMappings) {
    const groups = new Map();

    for (const fm of fieldMappings) {
        const key = `${fm.sourceObjectId}:${fm.targetObjectId}`;
        const current = groups.get(key);
        if (current) {
            current.fieldMappingCount += 1;
            continue;
        }

        groups.set(key, {
            id: key,
            sourceObjectId: fm.sourceObjectId,
            targetObjectId: fm.targetObjectId,
            sourceObject: fm.sourceObject,
            targetObject: fm.targetObject,
            fieldMappingCount: 1,
            createdAt: fm.createdAt,
            updatedAt: fm.updatedAt,
        });
    }

    return Array.from(groups.values());
}
