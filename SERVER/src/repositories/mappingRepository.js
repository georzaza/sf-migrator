/**
 * Mapping Repository - Database operations for FieldMapping
 */

import db from '../../models/index.js';
import logger from '../lib/logger.js';
const { FieldMapping, SfObjectMetadata, SfFieldMetadata } = db;
const log = logger.create('mappingRepository');

const FIELD_MAPPING_INCLUDES = [
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
    {
        model: SfFieldMetadata,
        as: 'sourceField',
        attributes: ['id', 'name', 'label', 'type', 'objectMetadataId', 'referenceTo', 'relationshipName'],
        required: false,
    },
    {
        model: SfFieldMetadata,
        as: 'targetField',
        attributes: ['id', 'name', 'label', 'type', 'objectMetadataId', 'referenceTo', 'relationshipName'],
    },
];

async function findFieldMappingById(id) {
    return FieldMapping.findByPk(id, { include: FIELD_MAPPING_INCLUDES });
}

async function findFieldMappingsByObjectPair(sourceObjectId, targetObjectId) {
    return FieldMapping.findAll({
        where: { sourceObjectId, targetObjectId },
        include: FIELD_MAPPING_INCLUDES,
        order: [['createdAt', 'ASC']],
    });
}

async function findFieldMappingsBySourceOrg(sourceOrgId) {
    return FieldMapping.findAll({
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
            {
                model: SfFieldMetadata,
                as: 'sourceField',
                attributes: ['id', 'name', 'label', 'type', 'objectMetadataId', 'referenceTo', 'relationshipName'],
                required: false,
            },
            {
                model: SfFieldMetadata,
                as: 'targetField',
                attributes: ['id', 'name', 'label', 'type', 'objectMetadataId', 'referenceTo', 'relationshipName'],
            },
        ],
        order: [['createdAt', 'DESC']],
    });
}

async function findFieldMappingsByOrgPair(sourceOrgId, targetOrgId) {
    return FieldMapping.findAll({
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
            {
                model: SfFieldMetadata,
                as: 'sourceField',
                attributes: ['id', 'name', 'label', 'type', 'objectMetadataId', 'referenceTo', 'relationshipName'],
                required: false,
            },
            {
                model: SfFieldMetadata,
                as: 'targetField',
                attributes: ['id', 'name', 'label', 'type', 'objectMetadataId', 'referenceTo', 'relationshipName'],
            },
        ],
        order: [['createdAt', 'DESC']],
    });
}

async function findFieldMappingsByTargetOrg(targetOrgId) {
    return FieldMapping.findAll({
        include: [
            {
                model: SfObjectMetadata,
                as: 'sourceObject',
                attributes: ['id', 'name', 'label', 'sfOrgId', 'custom'],
            },
            {
                model: SfObjectMetadata,
                as: 'targetObject',
                where: { sfOrgId: targetOrgId },
                attributes: ['id', 'name', 'label', 'sfOrgId', 'custom'],
            },
            {
                model: SfFieldMetadata,
                as: 'sourceField',
                attributes: ['id', 'name', 'label', 'type', 'objectMetadataId', 'referenceTo', 'relationshipName'],
                required: false,
            },
            {
                model: SfFieldMetadata,
                as: 'targetField',
                attributes: ['id', 'name', 'label', 'type', 'objectMetadataId', 'referenceTo', 'relationshipName'],
            },
        ],
        order: [['createdAt', 'DESC']],
    });
}

async function findFieldMappingByFields(sourceObjectId, targetObjectId, sourceFieldId, targetFieldId) {
    return FieldMapping.findOne({
        where: { sourceObjectId, targetObjectId, sourceFieldId, targetFieldId },
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

async function bulkDeleteFieldMappings(sourceObjectId, targetObjectId) {
    const count = await FieldMapping.destroy({ where: { sourceObjectId, targetObjectId } });
    log.info('Field mappings deleted in bulk', { sourceObjectId, targetObjectId, count });
    return count;
}

export default {
    findFieldMappingsBySourceOrg,
    findFieldMappingsByOrgPair,
    findFieldMappingsByTargetOrg,
    findFieldMappingById,
    findFieldMappingsByObjectPair,
    findFieldMappingByFields,
    createFieldMapping,
    updateFieldMapping,
    deleteFieldMapping,
    bulkDeleteFieldMappings,
};
