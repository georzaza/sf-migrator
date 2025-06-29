const { SfOrg, Project } = require('../../models');

async function getSfOrgById(id) {
    return await SfOrg.findByPk(id);
}

async function getSfOrgsByProjectId(projectId) {
    return await SfOrg.findAll({ where: { projectId } });
}

async function createSfOrg(sfOrgData) {
    const sforg = await SfOrg.create(sfOrgData);
    console.log('Salesforce Org created:', sforg);
    return sforg;
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
    const updatedOrg= await sfOrg.update(sfOrgData);
    console.log('Salesforce Org updated:', updatedOrg);
    return updatedOrg;
}

module.exports = {
    getSfOrgById,
    getSfOrgsByProjectId,
    createSfOrg,
    getAllSfOrgs,
    getSfOrgsByUserId,
    updateSfOrg,
};
