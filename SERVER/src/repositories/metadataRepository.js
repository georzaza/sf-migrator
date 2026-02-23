import db from '../../models/index.js';
import { mapSfField, SF_FIELD_COLUMNS } from '../utils/sfFieldMapper.js';
import { mapSfObject, SF_OBJECT_COLUMNS } from '../utils/sfObjectMapper.js';
const { SfObjectMetadata, SfFieldMetadata } = db;


async function findOrCreateObject(sfOrgId, objectData) {
    const mapped = mapSfObject(objectData);
    const [objectMetadata, created] = await SfObjectMetadata.findOrCreate({
        where: { sfOrgId, name: mapped.name },
        defaults: { sfOrgId, ...mapped, lastAnalyzed: new Date() },
    });

    if (!created) {
        const { name: _name, ...updateFields } = mapped;
        await objectMetadata.update({ ...updateFields, lastAnalyzed: new Date() });
    }
    return objectMetadata;
}


// isFormula and isRollUpSummary are GENERATED ALWAYS AS STORED columns — Postgres owns them.
// FIELD_UPSERT_COLUMNS and field mapping are defined in utils/sfFieldMapper.js.
function fieldDefaults(objectMetadataId, f) {
    return { objectMetadataId, ...mapSfField(f) };
}


async function findOrCreateField(objectMetadataId, fieldData) {
    const [fieldMetadata, created] = await SfFieldMetadata.findOrCreate({
        where: { objectMetadataId, name: fieldData.name },
        defaults: fieldDefaults(objectMetadataId, fieldData),
    });

    if (!created) {
        const { objectMetadataId: _omit, name: _name, ...updateFields } = fieldDefaults(objectMetadataId, fieldData);
        await fieldMetadata.update(updateFields);
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
        order: [['name', 'ASC']],
    };

    if (options.includeFields) {
        query.include = [{
            model: SfFieldMetadata,
            as: 'fields',
            order: [['name', 'ASC']],
        }];
    }
    return SfObjectMetadata.findAll(query);
}


async function findFieldsByObjectId(objectMetadataId) {
    return SfFieldMetadata.findAll({
        where: { objectMetadataId },
        order: [['name', 'ASC']],
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


async function bulkUpsertObjects(sfOrgId, objectDataArray) {
    if (!objectDataArray.length) return [];
    const now = new Date();
    const rows = objectDataArray.map(obj => ({
        sfOrgId,
        ...mapSfObject(obj),
        recordCount: obj.recordCount ?? null,
        lastAnalyzed: now,
    }));
    return SfObjectMetadata.bulkCreate(rows, {
        updateOnDuplicate: [...SF_OBJECT_COLUMNS, 'recordCount', 'lastAnalyzed', 'updatedAt'],
        conflictAttributes: ['sfOrgId', 'name'],
    });
}


async function bulkUpsertFields(fieldsArray) {
    if (!fieldsArray.length) return [];
    const rows = fieldsArray.map(f => fieldDefaults(f.objectMetadataId, f));
    return SfFieldMetadata.bulkCreate(rows, {
        updateOnDuplicate: SF_FIELD_COLUMNS,
        conflictAttributes: ['objectMetadataId', 'name'],
    });
}


async function getStats(sfOrgId) {
    const objects = await SfObjectMetadata.findAll({
        where: { sfOrgId },
        include: [{ model: SfFieldMetadata, as: 'fields', attributes: ['id'] }],
    });

    const totalObjects = objects.length;
    const customObjects = objects.filter(obj => obj.custom).length;
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


export default {
    findOrCreateObject,
    findOrCreateField,
    findObjectById,
    findObjectsByOrgId,
    findFieldsByObjectId,
    deleteObjectsByOrgId,
    bulkUpsertObjects,
    bulkUpsertFields,
    getStats,
};
