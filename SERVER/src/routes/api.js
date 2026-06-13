/**
 * API Routes
 *
 * All application endpoints dispatched via the `action` header.
 * Extracted from the monolithic server.js for clarity.
 */

import express from 'express';
<<<<<<< HEAD
import authMiddleware from '../middleware/authMiddleware.js';

import orgRepo from '../repositories/orgRepository.js';
import mdtRepo from '../repositories/metadataRepository.js';

import mdtService from '../services/metadataService.js';
import sfService from '../services/salesforceService.js';
import fsService from '../services/filesystemService.js';
import orgStatsService from '../services/orgStatsService.js';

import probeUrl from '../utils/probeUrl.js';
import sendResponse from '../utils/sendResponse.js';
import logger from '../lib/logger.js';

=======
const router = express.Router();

import authMiddleware from '../middleware/authMiddleware.js';
import projectRepo from '../repositories/projectRepository.js';
import orgRepo from '../repositories/orgRepository.js';
import metadataRepo from '../repositories/metadataRepository.js';
import mappingRepo from '../repositories/mappingRepository.js';
import mdtService from '../services/metadataService.js';
import sfService from '../services/salesforceService.js';
import probeUrl from '../utils/probeUrl.js';
import sendResponse from '../utils/sendResponse.js';
import logger from '../lib/logger.js';
>>>>>>> baed379c4165f113ea1b2ceeb37e220ba9d20803
const log = logger.create('api');
const router = express.Router();

// ===================== GET Requests =====================

router.get('/', authMiddleware, async (req, res) => {
    const action = req.get('action')?.toLowerCase();
    log.info(`Received /api GET request with action: ${action}`);

    if (action === 'get-orgs') {
        try {
            const sfOrgs = await orgRepo.findByUserId(req.user.id);
            sfOrgs.forEach(org => {
                org.clientId = org.clientId ? '*'.repeat(10) : null;
                org.clientSecret = org.clientSecret ? '*'.repeat(10) : null;
            });
            sendResponse(res, 200, true, 'Salesforce Orgs retrieved successfully', sfOrgs);
        } catch (error) {
            log.error('Failed to retrieve Salesforce Orgs', error, { userId: req.user.id });
            sendResponse(res, 500, false, 'Failed to retrieve Salesforce Orgs');
        }
    }

    else if (action === 'get-objects') {
        const orgId = req.headers.orgid;
        if (!orgId) {
            return sendResponse(res, 400, false, 'Org ID is required');
        }
        try {
            const includeFields = req.query.includeFields === 'true';
            const objects = await mdtRepo.findObjectsByOrgId(orgId, { includeFields });
            sendResponse(res, 200, true, 'Objects retrieved successfully', objects);
        } catch (error) {
            log.error('Failed to retrieve objects', error, { orgId });
            sendResponse(res, 500, false, `Failed to retrieve objects.`);
        }
    }

    else if (action === 'get-fields') {
        const objectId = req.headers.objectid;
        if (!objectId) {
            return sendResponse(res, 400, false, 'Object ID is required');
        }
        try {
            const fields = await mdtRepo.findFieldsByObjectId(objectId);
            sendResponse(res, 200, true, 'Fields retrieved successfully', fields);
        } catch (error) {
            log.error('Failed to retrieve fields', error, { objectId });
            sendResponse(res, 500, false, `Failed to retrieve fields.`);
        }
    }

    else if (action === 'get-org-status') {
        const orgId = req.headers.orgid;
        if (!orgId) {
            return sendResponse(res, 400, false, 'Org ID is required');
        }
        try {
            const sfOrg = await orgRepo.findById(orgId);
            if (!sfOrg) return sendResponse(res, 404, false, 'Org not found');
            const data = {
                analysisStatus: sfOrg.analysisStatus,
                analysisStartedAt: sfOrg.analysisStartedAt,
            };
            if (sfOrg.analysisStatus === 'auth_required') {
                data.authUrl = `/oauth2/auth?sfOrgId=${orgId}`;
            }
            sendResponse(res, 200, true, 'Org status retrieved', data);
        } catch (error) {
            log.error('Failed to retrieve org status', error, { orgId });
            sendResponse(res, 500, false, 'Failed to retrieve org status');
        }
    }

    else if (action === 'get-org-stats') {
        const orgId = req.headers.orgid;
        if (!orgId) {
            return sendResponse(res, 400, false, 'Org ID is required');
        }
        try {
            const stats = await fsService.getLatestOrgStats(orgId);
            sendResponse(res, 200, true, 'Metadata statistics retrieved successfully', stats);
        } catch (error) {
            log.error('Failed to retrieve metadata statistics', error, { orgId });
            sendResponse(res, 500, false, `Failed to retrieve metadata statistics.`);
        }
    }

    else {
        sendResponse(res, 400, false, 'Unknown GET action');
    }
});


// ===================== POST Requests =====================

router.post('/', authMiddleware, async (req, res) => {
    const action = req.headers.action?.toLowerCase();
    log.info(`Received /api POST request with action: ${action}`);

    if (action === 'analyze-org') {
        const { orgId, options } = req.body;
        if (!orgId) {
            return sendResponse(res, 400, false, 'No org provided.');
        }
        log.info('Starting org analysis', { orgId });
        try {
            // Verify OAuth connection exists BEFORE going async — so we can return 401 synchronously
            const conn = await sfService.connectToOrg(orgId);
            await orgRepo.updateAnalysisStatus(orgId, 'running');
            sendResponse(res, 202, true, 'Analysis started', { analysisStatus: 'running' });

            // STEP 1: object & field metadata retrieval
            // Return the inner promise so rejections propagate to the top level .catch
            mdtService.analyzeAndSaveOrg(orgId, options)
                .then(() => {
                    log.info('Objects & fields metadata retrieval was successful. Entering org stats calculation.', { orgId });
                    // STEP 2: org stats retrieval — returns the promise
                    return orgStatsService.calculateAndSaveOrgStats(conn, orgId);
                })
                .then(async () => {
                    log.info('Org stats retrieval was successful.', { orgId });
                    // STEP 3: all analysis completed, update db
                    await orgRepo.updateAnalysisStatus(orgId, 'complete');
                    log.info('Org analysis completed', { orgId });
                })
                .catch(async (error) => {
                    log.error('Org analysis failed', error, { orgId });
                    await orgRepo.updateAnalysisStatus(orgId, 'failed').catch(() => {});
                });

        } catch (error) {
            if (error.name === 'OAuthRequiredError') {
                log.warn('OAuth connection expired during analysis', { orgId });
                await orgRepo.updateAnalysisStatus(orgId, 'auth_required').catch(() => {});
                return res.status(401).json({ authUrl: error.authUrl });
            }
            log.error('Org analysis failed', error, { orgId });
            await orgRepo.updateAnalysisStatus(orgId, 'failed').catch(() => {});
            sendResponse(res, 500, false, 'Failed to run analysis');
        }
    }


    else if (action === 'test-sf-connection') {
        const { orgId } = req.body;
        if (!orgId) {
            return sendResponse(res, 400, false, 'No org provided.');
        }
        try {
            const result = await sfService.testConnection(orgId);
            sendResponse(res, 200, true, 'Connection test successful', result);
        } catch (error) {
            log.error('Error while testing connection', error, {orgId: orgId})
            sendResponse(res, 500, false, error.message || 'Connection test failed');
        }
    }

    else {
        sendResponse(res, 400, false, 'Unknown POST action');
    }
});


// ===================== PUT Requests =====================

router.put('/', authMiddleware, async (req, res) => {
    const action = req.headers.action?.toLowerCase();
    log.info(`Received /api PUT request with action: ${action}`);

    if (action === 'update-org') {
        const orgId = req.headers.orgid;
        const { loginURL } = req.body;
        if (loginURL) {
            if (!/^https:\/\/.+\.my\.salesforce\.com$/.test(loginURL)) {
                return sendResponse(res, 400, false, 'Login URL must start with https:// and end with .my.salesforce.com');
            }
            const reachable = await probeUrl(loginURL);
            if (!reachable) {
                return sendResponse(res, 400, false, `Cannot reach ${loginURL}. Verify the URL is correct and the org is active.`);
            }
        }
        try {
            await orgRepo.update(orgId, req.body);
            sendResponse(res, 200, true, 'Salesforce Org updated successfully');
        } catch (error) {
            log.error('Failed to update Salesforce Org', error, { orgId });
            sendResponse(res, 500, false, 'Failed to update Salesforce Org');
        }
    }

    else if (action === 'add-org') {
        const { loginURL } = req.body;
        if (!loginURL) {
            return sendResponse(res, 400, false, 'Login URL is required.');
        }
        if (!/^https:\/\/.+\.my\.salesforce\.com$/.test(loginURL)) {
            return sendResponse(res, 400, false, 'Login URL must start with https:// and end with .my.salesforce.com');
        }
        const reachable = await probeUrl(loginURL);
        if (!reachable) {
            return sendResponse(res, 400, false, `Cannot reach ${loginURL}. Verify the URL is correct and the org is active.`);
        }
        try {
            const org = await orgRepo.create({ ...req.body, userId: req.user.id });
            sendResponse(res, 201, true, 'Salesforce Org added successfully', org);
        } catch (error) {
            if (error.name === 'SequelizeValidationError') {
                return sendResponse(res, 400, false, error.message);
            }
            log.error('Failed to add Salesforce Org', error, { userId: req.user.id });
            sendResponse(res, 500, false, 'Failed to add Salesforce Org');
        }
    }

    else {
        sendResponse(res, 400, false, 'Unknown PUT action');
    }
});


// ===================== DELETE Requests =====================

router.delete('/', authMiddleware, async (req, res) => {
    const action = req.headers.action?.toLowerCase();
    log.info(`Received /api DELETE request with action: ${action}`);

    if (action === 'delete-org') {
        const orgId = req.headers.orgid;
        if (!orgId) {
            return sendResponse(res, 400, false, 'No org provided.');
        }
        try {
            await orgRepo.delete(orgId);
            sendResponse(res, 200, true, 'Salesforce Org deleted successfully');
        } catch (error) {
            log.error('Failed to delete Salesforce Org', error, { orgId });
            sendResponse(res, 500, false, 'Failed to delete Salesforce Org');
        }
    }

    else {
        sendResponse(res, 400, false, 'Unknown DELETE action');
    }
});

export default router;
