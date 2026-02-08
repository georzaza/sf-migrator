/**
 * Org Repository - Database operations for SfOrg model
 */

const { SfOrg, Project } = require('../../models');
const logger = require('../lib/logger');
const log = logger.create('orgRepository');

async function findById(id) {
    return SfOrg.findByPk(id);
}

async function findByProjectId(projectId) {
    return SfOrg.findAll({ where: { projectId } });
}

async function findByUserId(userId) {
    const projects = await Project.findAll({ where: { userId }, attributes: ['id'] });
    const projectIds = projects.map(p => p.id);
    if (!projectIds.length) return [];
    return SfOrg.findAll({ where: { projectId: projectIds } });
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

module.exports = {
    findById,
    findByProjectId,
    findByUserId,
    create,
    update,
    findAll,
    delete: remove,
};
