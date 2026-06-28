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
    upsert,
};
