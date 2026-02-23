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
    return sfOrg;
}


async function update(id, sfOrgData) {
    const sfOrg = await SfOrg.findByPk(id);
    if (!sfOrg) {
        throw new Error('Salesforce Org not found');
    }
    const updatedOrg = await sfOrg.update(sfOrgData);
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
}


async function updateAnalysisStatus(id, status) {
    const sfOrg = await SfOrg.findByPk(id);
    if (!sfOrg) throw new Error('Salesforce Org not found');
    const fields = { analysisStatus: status };
    if (status === 'running') fields.analysisStartedAt = new Date();
    await sfOrg.update(fields);
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
