/**
 * API Routes
 *
 * All application endpoints dispatched via the `action` header.
 * Extracted from the monolithic server.js for clarity.
 */

import express from 'express';

import authMiddleware from '../middleware/authMiddleware.js';
import orgRepo from '../repositories/orgRepository.js';
import mdtRepo from '../repositories/metadataRepository.js';
//import mappingRepo from '../repositories/mappingRepository.js';
import orgStatsService from '../services/orgStatsService.js';
import mdtService from '../services/metadataService.js';
import sfService from '../services/salesforceService.js';
import mappingService from '../services/mappingService.js';
import extractionService from '../services/extractionService.js';
import probeUrl from '../utils/probeUrl.js';
import sendResponse from '../utils/sendResponse.js';
import logger from '../lib/logger.js';
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
                org.accessToken = org.accessToken ? '*'.repeat(10) : null;
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

    else if (action === 'get-mappings') {
        const sourceOrgId = req.headers.sourceorgid;
        const targetOrgId = req.headers.targetorgid;

        if (!sourceOrgId) {
            return sendResponse(res, 400, false, 'Source Org ID is required');
        }

        try {
            let mappings;
            if (targetOrgId) {
                // Get mappings for specific org pair
                mappings = await mappingService.getObjectMappingsByOrgPair(sourceOrgId, targetOrgId);
            } else {
                // Get all mappings for source org
                mappings = await mappingService.getObjectMappingsBySourceOrg(sourceOrgId);
            }
            sendResponse(res, 200, true, 'Mappings retrieved successfully', mappings);
        } catch (error) {
            log.error('Failed to retrieve mappings', error, { sourceOrgId, targetOrgId });
            sendResponse(res, 500, false, 'Failed to retrieve mappings');
        }
    }

    else if (action === 'get-field-mappings') {
        const mappingId = req.headers.mappingid;
        if (!mappingId) {
            return sendResponse(res, 400, false, 'Mapping ID is required');
        }
        try {
            const fieldMappings = await mappingService.getFieldMappingsByObjectMapping(mappingId);
            sendResponse(res, 200, true, 'Field mappings retrieved successfully', fieldMappings);
        } catch (error) {
            log.error('Failed to retrieve field mappings', error, { mappingId });
            sendResponse(res, 500, false, 'Failed to retrieve field mappings');
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

    else if (action === 'create-mapping') {
        const { sourceObjectId, targetObjectId } = req.body;
        if (!sourceObjectId || !targetObjectId) {
            return sendResponse(res, 400, false, 'Source and target object IDs are required');
        }
        try {
            const mapping = await mappingService.upsertObjectMapping(sourceObjectId, targetObjectId);
            sendResponse(res, 201, true, 'Object mapping created successfully', mapping);
        } catch (error) {
            log.error('Failed to create object mapping', error, { sourceObjectId, targetObjectId });
            sendResponse(res, 500, false, error.message || 'Failed to create object mapping');
        }
    }

    else if (action === 'create-field-mapping') {
        const { sourceObjectId, targetObjectId, sourceFieldId, targetFieldId, mappingType, transformationRule, constantValue } = req.body;
        if (!sourceObjectId || !targetObjectId || !targetFieldId) {
            return sendResponse(res, 400, false, 'Source object ID, target object ID, and target field ID are required');
        }
        try {
            const mapping = await mappingService.createFieldMapping({
                sourceObjectId,
                targetObjectId,
                sourceFieldId,
                targetFieldId,
                mappingType: mappingType || 'as-is',
                transformationRule,
                constantValue
            });
            sendResponse(res, 201, true, 'Field mapping created successfully', mapping);
        } catch (error) {
            log.error('Failed to create field mapping', error, { sourceObjectId, targetObjectId });
            sendResponse(res, 500, false, error.message || 'Failed to create field mapping');
        }
    }

    else if (action === 'start-extraction') {
        const { sourceOrgId, targetOrgId } = req.body;
        if (!sourceOrgId && !targetOrgId) {
            return sendResponse(res, 400, false, 'sourceOrgId or targetOrgId is required');
        }

        const extractionMode = sourceOrgId ? 'source-org' : 'target-org';
        log.info('Extraction request received', { extractionMode, sourceOrgId, targetOrgId });

        try {
            const summary = sourceOrgId
                ? await extractionService.runExtraction({ sourceOrgId, targetOrgId: targetOrgId || null })
                : await extractionService.runExtractionForTargetOrg({ targetOrgId });

            log.info('Extraction completed', {
                extractionMode,
                sourceOrgId,
                targetOrgId,
                totalObjects: summary.totalObjects,
                successCount: summary.successCount,
                failedCount: summary.failedCount,
            });
            sendResponse(res, 200, true, 'Extraction completed', summary);
        } catch (error) {
            if (error.name === 'OAuthRequiredError') {
                log.warn('Extraction blocked: OAuth required', { extractionMode, sourceOrgId, targetOrgId });
                return res.status(401).json({ authUrl: error.authUrl });
            }
            log.error('Failed to run extraction', error, { extractionMode, sourceOrgId, targetOrgId });
            sendResponse(res, 500, false, error.message || 'Failed to run extraction');
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

    else if (action === 'update-mapping') {
        const mappingId = req.headers.mappingid;
        if (!mappingId) {
            return sendResponse(res, 400, false, 'Mapping ID is required');
        }
        try {
            const mapping = await mappingService.updateObjectMapping(mappingId, req.body);
            sendResponse(res, 200, true, 'Object mapping updated successfully', mapping);
        } catch (error) {
            log.error('Failed to update object mapping', error, { mappingId });
            sendResponse(res, 500, false, error.message || 'Failed to update object mapping');
        }
    }

    else if (action === 'update-field-mapping') {
        const mappingId = req.headers.mappingid;
        if (!mappingId) {
            return sendResponse(res, 400, false, 'Mapping ID is required');
        }
        try {
            const mapping = await mappingService.updateFieldMapping(mappingId, req.body);
            sendResponse(res, 200, true, 'Field mapping updated successfully', mapping);
        } catch (error) {
            log.error('Failed to update field mapping', error, { mappingId });
            sendResponse(res, 500, false, error.message || 'Failed to update field mapping');
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

    else if (action === 'delete-mapping') {
        const mappingId = req.headers.mappingid;
        if (!mappingId) {
            return sendResponse(res, 400, false, 'Mapping ID is required');
        }
        try {
            await mappingService.deleteObjectMapping(mappingId);
            sendResponse(res, 200, true, 'Object mapping deleted successfully');
        } catch (error) {
            log.error('Failed to delete object mapping', error, { mappingId });
            sendResponse(res, 500, false, error.message || 'Failed to delete object mapping');
        }
    }

    else if (action === 'delete-field-mapping') {
        const mappingId = req.headers.mappingid;
        if (!mappingId) {
            return sendResponse(res, 400, false, 'Mapping ID is required');
        }
        try {
            await mappingService.deleteFieldMapping(mappingId);
            sendResponse(res, 200, true, 'Field mapping deleted successfully');
        } catch (error) {
            log.error('Failed to delete field mapping', error, { mappingId });
            sendResponse(res, 500, false, error.message || 'Failed to delete field mapping');
        }
    }

    else {
        sendResponse(res, 400, false, 'Unknown DELETE action');
    }
});

export default router;
