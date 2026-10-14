/**
 * Record Expansion Repository - persistence for object-level explode transforms.
 */

import db from '../../models/index.js';
import logger from '../lib/logger.js';

const { RecordExpansion, SfObjectMetadata } = db;
const log = logger.create('recordExpansionRepository');

const INCLUDES = [
    {
        model: SfObjectMetadata,
        as: 'sourceObject',
        attributes: ['id', 'name', 'label', 'sfOrgId'],
    },
    {
        model: SfObjectMetadata,
        as: 'targetObject',
        attributes: ['id', 'name', 'label', 'sfOrgId'],
    },
];

async function findById(id) {
    return RecordExpansion.findByPk(id, { include: INCLUDES });
}

async function findByObjectPair(sourceObjectId, targetObjectId) {
    return RecordExpansion.findOne({ where: { sourceObjectId, targetObjectId }, include: INCLUDES });
}

async function findByOrgPair(sourceOrgId, targetOrgId) {
    return RecordExpansion.findAll({
        include: [
            { model: SfObjectMetadata, as: 'sourceObject', where: { sfOrgId: sourceOrgId }, attributes: ['id', 'name', 'label', 'sfOrgId'] },
            { model: SfObjectMetadata, as: 'targetObject', where: { sfOrgId: targetOrgId }, attributes: ['id', 'name', 'label', 'sfOrgId'] },
        ],
        order: [['createdAt', 'ASC']],
    });
}

async function findBySourceOrg(sourceOrgId) {
    return RecordExpansion.findAll({
        include: [
            { model: SfObjectMetadata, as: 'sourceObject', where: { sfOrgId: sourceOrgId }, attributes: ['id', 'name', 'label', 'sfOrgId'] },
            { model: SfObjectMetadata, as: 'targetObject', attributes: ['id', 'name', 'label', 'sfOrgId'] },
        ],
        order: [['createdAt', 'ASC']],
    });
}

async function upsert(sourceObjectId, targetObjectId, variants) {
    const existing = await RecordExpansion.findOne({ where: { sourceObjectId, targetObjectId } });
    if (existing) {
        await existing.update({ variants });
        log.info('Record expansion updated', { id: existing.id });
        return findById(existing.id);
    }
    const created = await RecordExpansion.create({ sourceObjectId, targetObjectId, variants });
    log.info('Record expansion created', { id: created.id });
    return findById(created.id);
}

async function remove(id) {
    const row = await RecordExpansion.findByPk(id);
    if (!row) throw new Error('Record expansion not found');
    await row.destroy();
    log.info('Record expansion deleted', { id });
}

export default {
    findById,
    findByObjectPair,
    findByOrgPair,
    findBySourceOrg,
    upsert,
    remove,
};
