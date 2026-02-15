/* TODO
'use strict';

const analysisRepo = require('../repositories/analysisRepository');
const metadataService = require('./metadataService');
const { Analysis } = require('../../models');
const logger = require('../lib/logger');
const log = logger.create('analysisService');

async function startAnalysis(orgId, options = {}) {
    const analysis = await analysisRepo.createAnalysis(orgId, { status: 'pending' });

    setImmediate(async () => {
        try {
            await analysisRepo.updateAnalysis(analysis.id, { status: 'in_progress', startedAt: new Date() });
            const progressCallback = async (progress) => {
                await analysisRepo.updateAnalysis(analysis.id, { progress });
            };
            const result = await metadataService.analyzeAndSaveOrg(orgId, options, progressCallback);
            await Analysis.update({ status: 'superseded' }, { where: { orgId, status: 'completed' } });
            await analysisRepo.updateAnalysis(analysis.id, {
                status: 'completed',
                results: result,
                completedAt: new Date(),
            });
            log.info('Analysis completed for org', { orgId, analysisId: analysis.id });
        } catch (error) {
            log.error('Analysis job failed', error, { orgId, analysisId: analysis.id });
            await analysisRepo.updateAnalysis(analysis.id, {
                status: 'failed',
                errorLog: { message: error },
                completedAt: new Date(),
            });
        }
    });

    return analysis;
}

module.exports = {
    startAnalysis,
};
*/
