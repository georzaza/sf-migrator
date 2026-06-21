/**
 * Mapping Service - Business logic for field mappings
 */

import mappingRepo from '../repositories/mappingRepository.js';
import metadataRepo from '../repositories/metadataRepository.js';
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

    return mapping;
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

    return await mappingRepo.updateFieldMapping(mappingId, filteredUpdates);
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
