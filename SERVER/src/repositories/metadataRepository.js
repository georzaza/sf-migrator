/**
 * Metadata Repository - Database operations for SfObjectMetadata and SfFieldMetadata
 */

const { SfObjectMetadata, SfFieldMetadata } = require('../../models');

async function findOrCreateObject(sfOrgId, objectData) {
    const [objectMetadata, created] = await SfObjectMetadata.findOrCreate({
        where: { sfOrgId, objectName: objectData.objectName },
        defaults: {
            sfOrgId,
            objectName: objectData.objectName,
            objectLabel: objectData.objectLabel,
            isCustom: objectData.isCustom,
            recordCount: objectData.recordCount,
            lastAnalyzed: new Date(),
        },
    });

    if (!created) {
        await objectMetadata.update({
            objectLabel: objectData.objectLabel,
            isCustom: objectData.isCustom,
            recordCount: objectData.recordCount,
            lastAnalyzed: new Date(),
        });
    }

    return objectMetadata;
}

async function findOrCreateField(objectMetadataId, fieldData) {
    const [fieldMetadata, created] = await SfFieldMetadata.findOrCreate({
        where: { objectMetadataId, fieldName: fieldData.fieldName },
        defaults: {
            objectMetadataId,
            fieldName: fieldData.fieldName,
            fieldLabel: fieldData.fieldLabel,
            dataType: fieldData.dataType,
            length: fieldData.length,
            isRequired: fieldData.isRequired,
            isCustom: fieldData.isCustom,
            picklistValues: fieldData.picklistValues,
        },
    });

    if (!created) {
        await fieldMetadata.update({
            fieldLabel: fieldData.fieldLabel,
            dataType: fieldData.dataType,
            length: fieldData.length,
            isRequired: fieldData.isRequired,
            isCustom: fieldData.isCustom,
            picklistValues: fieldData.picklistValues,
        });
    }

    return fieldMetadata;
}

async function findObjectById(id, options = {}) {
    const query = {};
    if (options.includeFields) {
        query.include = [{ model: SfFieldMetadata, as: 'fields' }];
    }
    return SfObjectMetadata.findByPk(id, query);
}

async function findObjectsByOrgId(sfOrgId, options = {}) {
    const query = {
        where: { sfOrgId },
        order: [['objectName', 'ASC']],
    };

    if (options.includeFields) {
        query.include = [{
            model: SfFieldMetadata,
            as: 'fields',
            order: [['fieldName', 'ASC']],
        }];
    }

    return SfObjectMetadata.findAll(query);
}

async function findFieldsByObjectId(objectMetadataId) {
    return SfFieldMetadata.findAll({
        where: { objectMetadataId },
        order: [['fieldName', 'ASC']],
    });
}

async function deleteObjectsByOrgId(sfOrgId) {
    const objects = await SfObjectMetadata.findAll({ where: { sfOrgId } });

    for (const obj of objects) {
        await SfFieldMetadata.destroy({ where: { objectMetadataId: obj.id } });
    }

    const deletedCount = await SfObjectMetadata.destroy({ where: { sfOrgId } });
    return deletedCount;
}

async function getStats(sfOrgId) {
    const objects = await SfObjectMetadata.findAll({
        where: { sfOrgId },
        include: [{ model: SfFieldMetadata, as: 'fields', attributes: ['id'] }],
    });

    const totalObjects = objects.length;
    const customObjects = objects.filter(obj => obj.isCustom).length;
    const totalFields = objects.reduce((sum, obj) => sum + obj.fields.length, 0);
    const totalRecords = objects.reduce((sum, obj) => sum + (obj.recordCount || 0), 0);
    const lastAnalyzed = objects.length > 0
        ? objects.reduce((latest, obj) => (obj.lastAnalyzed > latest ? obj.lastAnalyzed : latest), objects[0].lastAnalyzed)
        : null;

    return {
        totalObjects,
        customObjects,
        standardObjects: totalObjects - customObjects,
        totalFields,
        totalRecords,
        lastAnalyzed,
    };
}

module.exports = {
    findOrCreateObject,
    findOrCreateField,
    findObjectById,
    findObjectsByOrgId,
    findFieldsByObjectId,
    deleteObjectsByOrgId,
    getStats,
};
