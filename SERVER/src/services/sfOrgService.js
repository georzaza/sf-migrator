const { SfOrg, Project } = require('../../models');

async function getSfOrgById(id) {
    return await SfOrg.findByPk(id);
}

async function getSfOrgsByProjectId(projectId) {
    return await SfOrg.findAll({ where: { projectId } });
}

async function createSfOrg(sfOrgData) {
    return await SfOrg.create(sfOrgData);
}

async function getAllSfOrgs() {
    return await SfOrg.findAll();
}

async function getSfOrgsByUserId(userId) {
    const projects = await Project.findAll({ where: { userId }, attributes: ['id'] });
    const projectIds = projects.map(p => p.id);
    if (!projectIds.length)
        return [];
    return await SfOrg.findAll({ where: { projectId: projectIds } });
}

async function updateSfOrg(id, sfOrgData) {
    const sfOrg = await SfOrg.findByPk(id);
    if (!sfOrg) {
        throw new Error('Salesforce Org not found');
    }
    return await sfOrg.update(sfOrgData);
}

module.exports = {
    getSfOrgById,
    getSfOrgsByProjectId,
    createSfOrg,
    getAllSfOrgs,
    getSfOrgsByUserId,
    updateSfOrg,
};
