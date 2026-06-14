/**
 * Mapping Repository - Database operations for ObjectMapping and FieldMapping
 */

import db from '../../models/index.js';
import logger from '../lib/logger.js';
const { ObjectMapping, FieldMapping, SfObjectMetadata, SfFieldMetadata } = db;
const log = logger.create('mappingRepository');

const OBJECT_MAPPING_INCLUDES = [
    {
        model: SfObjectMetadata,
        as: 'sourceObject',
        attributes: ['id', 'name', 'label', 'sfOrgId', 'custom'],
    },
    {
        model: SfObjectMetadata,
        as: 'targetObject',
        attributes: ['id', 'name', 'label', 'sfOrgId', 'custom'],
    },
];

const FIELD_MAPPING_INCLUDES = [
    {
        model: ObjectMapping,
        as: 'objectMapping',
        attributes: ['id', 'sourceObjectId', 'targetObjectId', 'mappingStatus'],
    },
    {
        model: SfFieldMetadata,
        as: 'sourceField',
        attributes: ['id', 'name', 'label', 'type', 'objectMetadataId'],
        required: false,
    },
    {
        model: SfFieldMetadata,
        as: 'targetField',
        attributes: ['id', 'name', 'label', 'type', 'objectMetadataId'],
    },
];

// ==================== Object Mapping Methods ====================

async function findObjectMappingById(id) {
    return ObjectMapping.findByPk(id, { include: OBJECT_MAPPING_INCLUDES });
}

async function findObjectMappingByObjects(sourceObjectId, targetObjectId) {
    return ObjectMapping.findOne({
        where: { sourceObjectId, targetObjectId },
        include: OBJECT_MAPPING_INCLUDES,
    });
}

async function findObjectMappingsBySourceOrg(sourceOrgId) {
    return ObjectMapping.findAll({
        include: [
            {
                model: SfObjectMetadata,
                as: 'sourceObject',
                where: { sfOrgId: sourceOrgId },
                attributes: ['id', 'name', 'label', 'sfOrgId', 'custom'],
            },
            {
                model: SfObjectMetadata,
                as: 'targetObject',
                attributes: ['id', 'name', 'label', 'sfOrgId', 'custom'],
            },
        ],
        order: [['createdAt', 'DESC']],
    });
}

async function findObjectMappingsByOrgPair(sourceOrgId, targetOrgId) {
    return ObjectMapping.findAll({
        include: [
            {
                model: SfObjectMetadata,
                as: 'sourceObject',
                where: { sfOrgId: sourceOrgId },
                attributes: ['id', 'name', 'label', 'sfOrgId', 'custom'],
            },
            {
                model: SfObjectMetadata,
                as: 'targetObject',
                where: { sfOrgId: targetOrgId },
                attributes: ['id', 'name', 'label', 'sfOrgId', 'custom'],
            },
        ],
        order: [['createdAt', 'DESC']],
    });
}

async function createObjectMapping(data) {
    const mapping = await ObjectMapping.create(data);
    log.info('Object mapping created', { mappingId: mapping.id });
    return ObjectMapping.findByPk(mapping.id, { include: OBJECT_MAPPING_INCLUDES });
}

async function updateObjectMapping(id, data) {
    const mapping = await ObjectMapping.findByPk(id);
    if (!mapping) throw new Error('Object mapping not found');
    await mapping.update(data);
    log.info('Object mapping updated', { mappingId: id });
    return ObjectMapping.findByPk(id, { include: OBJECT_MAPPING_INCLUDES });
}

async function deleteObjectMapping(id) {
    const mapping = await ObjectMapping.findByPk(id);
    if (!mapping) throw new Error('Object mapping not found');
    // Delete all field mappings first
    await FieldMapping.destroy({ where: { objectMappingId: id } });
    await mapping.destroy();
    log.info('Object mapping deleted', { mappingId: id });
}

// ==================== Field Mapping Methods ====================

async function findFieldMappingById(id) {
    return FieldMapping.findByPk(id, { include: FIELD_MAPPING_INCLUDES });
}

async function findFieldMappingsByObjectMapping(objectMappingId) {
    return FieldMapping.findAll({
        where: { objectMappingId },
        include: FIELD_MAPPING_INCLUDES,
        order: [['createdAt', 'ASC']],
    });
}

async function findFieldMappingByFields(objectMappingId, sourceFieldId, targetFieldId) {
    return FieldMapping.findOne({
        where: { objectMappingId, sourceFieldId, targetFieldId },
        include: FIELD_MAPPING_INCLUDES,
    });
}

async function createFieldMapping(data) {
    const mapping = await FieldMapping.create(data);
    log.info('Field mapping created', { mappingId: mapping.id });
    return FieldMapping.findByPk(mapping.id, { include: FIELD_MAPPING_INCLUDES });
}

async function updateFieldMapping(id, data) {
    const mapping = await FieldMapping.findByPk(id);
    if (!mapping) throw new Error('Field mapping not found');
    await mapping.update(data);
    log.info('Field mapping updated', { mappingId: id });
    return FieldMapping.findByPk(id, { include: FIELD_MAPPING_INCLUDES });
}

async function deleteFieldMapping(id) {
    const mapping = await FieldMapping.findByPk(id);
    if (!mapping) throw new Error('Field mapping not found');
    await mapping.destroy();
    log.info('Field mapping deleted', { mappingId: id });
}

async function bulkDeleteFieldMappings(objectMappingId) {
    const count = await FieldMapping.destroy({ where: { objectMappingId } });
    log.info('Field mappings deleted in bulk', { objectMappingId, count });
    return count;
}

export default {
    // Object mapping methods
    findObjectMappingById,
    findObjectMappingByObjects,
    findObjectMappingsBySourceOrg,
    findObjectMappingsByOrgPair,
    createObjectMapping,
    updateObjectMapping,
    deleteObjectMapping,

    // Field mapping methods
    findFieldMappingById,
    findFieldMappingsByObjectMapping,
    findFieldMappingByFields,
    createFieldMapping,
    updateFieldMapping,
    deleteFieldMapping,
    bulkDeleteFieldMappings,
};
