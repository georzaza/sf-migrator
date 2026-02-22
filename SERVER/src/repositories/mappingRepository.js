/**
 * Mapping Repository - Database operations for ObjectMapping and FieldMapping
 */

import db from '../../models/index.js';
const { ObjectMapping, FieldMapping, SfObjectMetadata, SfFieldMetadata } = db;

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
        attributes: ['id', 'projectId', 'sourceObjectId', 'targetObjectId'],
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

async function findObjectMappingsByProjectId(projectId) {
    return ObjectMapping.findAll({
        where: { projectId },
        include: OBJECT_MAPPING_INCLUDES,
        order: [['createdAt', 'DESC']],
    });
}

async function findFieldMappingsByProjectId(projectId) {
    return FieldMapping.findAll({
        include: [
            {
                model: ObjectMapping,
                as: 'objectMapping',
                where: { projectId },
                attributes: ['id', 'projectId', 'sourceObjectId', 'targetObjectId'],
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
        ],
        order: [['createdAt', 'DESC']],
    });
}

async function createObjectMapping(data) {
    const mapping = await ObjectMapping.create(data);
    return ObjectMapping.findByPk(mapping.id, { include: OBJECT_MAPPING_INCLUDES });
}

async function createFieldMapping(data) {
    const mapping = await FieldMapping.create(data);
    return FieldMapping.findByPk(mapping.id, { include: FIELD_MAPPING_INCLUDES });
}

async function updateObjectMapping(id, data) {
    const mapping = await ObjectMapping.findByPk(id);
    if (!mapping) throw new Error('Object mapping not found');
    await mapping.update(data);
    return ObjectMapping.findByPk(id, { include: OBJECT_MAPPING_INCLUDES });
}

async function updateFieldMapping(id, data) {
    const mapping = await FieldMapping.findByPk(id);
    if (!mapping) throw new Error('Field mapping not found');
    await mapping.update(data);
    return FieldMapping.findByPk(id, { include: FIELD_MAPPING_INCLUDES });
}

async function deleteObjectMapping(id) {
    const mapping = await ObjectMapping.findByPk(id);
    if (!mapping) throw new Error('Object mapping not found');
    await FieldMapping.destroy({ where: { objectMappingId: id } });
    await mapping.destroy();
}

async function deleteFieldMapping(id) {
    const mapping = await FieldMapping.findByPk(id);
    if (!mapping) throw new Error('Field mapping not found');
    await mapping.destroy();
}

export default {
    findObjectMappingsByProjectId,
    findFieldMappingsByProjectId,
    createObjectMapping,
    createFieldMapping,
    updateObjectMapping,
    updateFieldMapping,
    deleteObjectMapping,
    deleteFieldMapping,
};
