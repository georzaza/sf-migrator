/* todo
'use strict';

const { Analysis } = require('../../models');

async function createAnalysis(orgId, initial = {}) {
    return Analysis.create({ orgId, ...initial });
}

async function updateAnalysis(id, patch) {
    const a = await Analysis.findByPk(id);
    if (!a) return null;
    return a.update(patch);
}

async function findLatestByOrgId(orgId) {
    return Analysis.findOne({ where: { orgId }, order: [['createdAt', 'DESC']] });
}

async function findById(id) {
    return Analysis.findByPk(id);
}

module.exports = {
    createAnalysis,
    updateAnalysis,
    findLatestByOrgId,
    findById,
};
*/
