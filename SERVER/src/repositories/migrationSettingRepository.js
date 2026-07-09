/**
 * MigrationSetting Repository - per object-pair migration settings persistence
 */

import db from '../../models/index.js';

const { MigrationSetting, SfObjectMetadata } = db;

const SETTING_INCLUDES = [
    { model: SfObjectMetadata, as: 'sourceObject', attributes: ['id', 'name', 'label', 'sfOrgId'] },
    { model: SfObjectMetadata, as: 'targetObject', attributes: ['id', 'name', 'label', 'sfOrgId'] },
];

async function findByObjectPair(sourceObjectId, targetObjectId) {
    return MigrationSetting.findOne({
        where: { sourceObjectId, targetObjectId },
        include: SETTING_INCLUDES,
    });
}

/**
 * Return every MigrationSetting whose source object lives in `sourceOrgId` AND
 * whose target object lives in `targetOrgId`. The DB has no direct FK from
 * MigrationSetting to an org, so we filter via the included objects.
 */
async function findAllByOrgPair(sourceOrgId, targetOrgId) {
    return MigrationSetting.findAll({
        include: [
            { model: SfObjectMetadata, as: 'sourceObject', attributes: ['id', 'name', 'label', 'sfOrgId'], where: { sfOrgId: sourceOrgId } },
            { model: SfObjectMetadata, as: 'targetObject', attributes: ['id', 'name', 'label', 'sfOrgId'], where: { sfOrgId: targetOrgId } },
        ],
    });
}

async function upsert(sourceObjectId, targetObjectId, fields) {
    const [setting, created] = await MigrationSetting.findOrCreate({
        where: { sourceObjectId, targetObjectId },
        defaults: { sourceObjectId, targetObjectId, ...fields },
    });

    if (!created) {
        await setting.update(fields);
    }

    return MigrationSetting.findByPk(setting.id, { include: SETTING_INCLUDES });
}

export default {
    findByObjectPair,
    findAllByOrgPair,
    upsert,
};
