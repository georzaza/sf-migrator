/**
 * Mapping Service - Business logic for object and field mappings
 */

import mappingRepo from '../repositories/mappingRepository.js';
import metadataRepo from '../repositories/metadataRepository.js';
import logger from '../lib/logger.js';

const log = logger.create('mappingService');

/**
 * Get all object mappings for a source org
 */
async function getObjectMappingsBySourceOrg(sourceOrgId) {
    return await mappingRepo.findObjectMappingsBySourceOrg(sourceOrgId);
}

/**
 * Get all object mappings for a specific org pair
 */
async function getObjectMappingsByOrgPair(sourceOrgId, targetOrgId) {
    return await mappingRepo.findObjectMappingsByOrgPair(sourceOrgId, targetOrgId);
}

/**
 * Create or update an object mapping
 */
async function upsertObjectMapping(sourceObjectId, targetObjectId) {
    // Check if mapping already exists
    const existing = await mappingRepo.findObjectMappingByObjects(sourceObjectId, targetObjectId);

    if (existing) {
        log.info('Object mapping already exists', { mappingId: existing.id });
        return existing;
    }

    // Validate source and target objects exist
    const sourceObject = await metadataRepo.findObjectById(sourceObjectId);
    const targetObject = await metadataRepo.findObjectById(targetObjectId);

    if (!sourceObject) {
        throw new Error(`Source object not found: ${sourceObjectId}`);
    }
    if (!targetObject) {
        throw new Error(`Target object not found: ${targetObjectId}`);
    }

    // Create new mapping
    const mapping = await mappingRepo.createObjectMapping({
        sourceObjectId,
        targetObjectId,
        mappingStatus: 'draft',
        isActive: true
    });

    log.info('Object mapping created', {
        mappingId: mapping.id,
        sourceObject: sourceObject.name,
        targetObject: targetObject.name
    });

    return mapping;
}

/**
 * Update object mapping properties
 */
async function updateObjectMapping(mappingId, updates) {
    const allowedFields = ['mappingStatus', 'isActive'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
        }
    }

    return await mappingRepo.updateObjectMapping(mappingId, filteredUpdates);
}

/**
 * Delete an object mapping and all associated field mappings
 */
async function deleteObjectMapping(mappingId) {
    return await mappingRepo.deleteObjectMapping(mappingId);
}

/**
 * Get all field mappings for an object mapping
 */
async function getFieldMappingsByObjectMapping(objectMappingId) {
    return await mappingRepo.findFieldMappingsByObjectMapping(objectMappingId);
}

/**
 * Create a field mapping
 */
async function createFieldMapping(data) {
    const { objectMappingId, sourceFieldId, targetFieldId, mappingType, transformationRule, constantValue } = data;

    // Validate object mapping exists
    const objectMapping = await mappingRepo.findObjectMappingById(objectMappingId);
    if (!objectMapping) {
        throw new Error(`Object mapping not found: ${objectMappingId}`);
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

    // For expression mapping, require transformationRule
    if (mappingType === 'expression' && !transformationRule) {
        throw new Error('Transformation rule is required for expression mapping');
    }

    // For constant mapping, require constantValue
    if (mappingType === 'constant' && !constantValue) {
        throw new Error('Constant value is required for constant mapping');
    }

    // Create the field mapping
    const mapping = await mappingRepo.createFieldMapping({
        objectMappingId,
        sourceFieldId: sourceFieldId || null,
        targetFieldId,
        mappingType,
        transformationRule: transformationRule || null,
        constantValue: constantValue || null,
        isActive: true
    });

    log.info('Field mapping created', { mappingId: mapping.id, objectMappingId });

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

    const allowedFields = ['sourceFieldId', 'targetFieldId', 'mappingType', 'transformationRule', 'constantValue', 'isActive'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
        }
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
    // Object mapping methods
    getObjectMappingsBySourceOrg,
    getObjectMappingsByOrgPair,
    upsertObjectMapping,
    updateObjectMapping,
    deleteObjectMapping,

    // Field mapping methods
    getFieldMappingsByObjectMapping,
    createFieldMapping,
    updateFieldMapping,
    deleteFieldMapping,
};
