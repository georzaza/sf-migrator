/**
 * Org Repository - Database operations for SfOrg model
 */

import db from '../../models/index.js';
import logger from '../lib/logger.js';
const { SfOrg } = db;
const log = logger.create('orgRepository');

async function findById(id) {
    return SfOrg.findByPk(id);
}

async function findByUserId(userId) {
    return SfOrg.findAll({ where: { userId } });
}

async function create(sfOrgData) {
    const sfOrg = await SfOrg.create(sfOrgData);
    log.info('Salesforce Org created', { orgId: sfOrg.id, name: sfOrg.name });
    return sfOrg;
}

async function update(id, sfOrgData) {
    const sfOrg = await SfOrg.findByPk(id);
    if (!sfOrg) {
        throw new Error('Salesforce Org not found');
    }
    const updatedOrg = await sfOrg.update(sfOrgData);
    log.info('Salesforce Org updated', { orgId: id });
    return updatedOrg;
}

async function findAll() {
    return SfOrg.findAll();
}

async function remove(id) {
    const sfOrg = await SfOrg.findByPk(id);
    if (!sfOrg) {
        throw new Error('Salesforce Org not found');
    }
    await sfOrg.destroy();
    log.info('Salesforce Org deleted', { orgId: id });
}

async function updateAnalysisStatus(id, status) {
    const sfOrg = await SfOrg.findByPk(id);
    if (!sfOrg) throw new Error('Salesforce Org not found');
    const fields = { analysisStatus: status };
    if (status === 'running') fields.analysisStartedAt = new Date();
    await sfOrg.update(fields);
    log.info('Analysis status updated', { orgId: id, status });
    return sfOrg;
}

export default {
    findById,
    findByUserId,
    create,
    update,
    findAll,
    delete: remove,
    updateAnalysisStatus,
};
