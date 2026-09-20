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
import mdtService from '../services/metadataService.js';
import sfService from '../services/salesforceService.js';
import mappingService from '../services/mappingService.js';
import extractionService from '../services/extractionService.js';
import transformService from '../services/transformService.js';
import dependencyService from '../services/dependencyService.js';
import migrationSettingService from '../services/migrationSettingService.js';
import tracebackService from '../services/tracebackService.js';
import sourceObjectFilterService from '../services/sourceObjectFilterService.js';
import loadService from '../services/loadService.js';
import validationService from '../services/validationService.js';
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
            const sfOrgsRaw = await orgRepo.findByUserId(req.user.id);
            // Convert Sequelize instances to plain objects FIRST — otherwise dynamically
            // added fields (hasAccessToken) are silently stripped by toJSON() during serialization.
            const sfOrgs = sfOrgsRaw.map(org => {
                const plain = org.get ? org.get({ plain: true }) : { ...org };
                plain.hasAccessToken = !!(plain.accessToken);
                plain.clientId = plain.clientId ? '*'.repeat(10) : null;
                plain.clientSecret = plain.clientSecret ? '*'.repeat(10) : null;
                plain.accessToken = plain.accessToken ? '*'.repeat(10) : null;
                return plain;
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

    else if (action === 'get-extraction-status') {
        const orgId = req.headers.orgid;
        if (!orgId) {
            return sendResponse(res, 400, false, 'Org ID is required');
        }
        try {
            const sfOrg = await orgRepo.findById(orgId);
            if (!sfOrg) return sendResponse(res, 404, false, 'Org not found');
            const data = {
                extractionStatus: sfOrg.extractionStatus || 'idle',
                summary: sfOrg.extractionSummary || null,
                error: sfOrg.extractionError || null,
                currentObject: extractionService.getProgress(orgId)?.objectName ?? null,
                objectsRemaining: extractionService.getProgress(orgId)?.remaining ?? null,
            };
            sendResponse(res, 200, true, 'Extraction status retrieved', data);
        } catch (error) {
            log.error('Failed to retrieve extraction status', error, { orgId });
            sendResponse(res, 500, false, 'Failed to retrieve extraction status');
        }
    }

    else if (action === 'get-transform-status') {
        const sourceOrgId = req.headers.sourceorgid;
        const targetOrgId = req.headers.targetorgid;
        if (!sourceOrgId || !targetOrgId) {
            return sendResponse(res, 400, false, 'sourceOrgId and targetOrgId are required');
        }
        try {
            const status = transformService.getTransformStatus(sourceOrgId, targetOrgId);
            sendResponse(res, 200, true, 'Transform status retrieved', status);
        } catch (error) {
            log.error('Failed to retrieve transform status', error, { sourceOrgId, targetOrgId });
            sendResponse(res, 500, false, 'Failed to retrieve transform status');
        }
    }

    else if (action === 'get-load-status') {
        const sourceOrgId = req.headers.sourceorgid;
        const targetOrgId = req.headers.targetorgid;
        if (!sourceOrgId || !targetOrgId) {
            return sendResponse(res, 400, false, 'sourceOrgId and targetOrgId are required');
        }
        try {
            const status = loadService.getLoadStatus(sourceOrgId, targetOrgId);
            sendResponse(res, 200, true, 'Load status retrieved', status);
        } catch (error) {
            log.error('Failed to retrieve load status', error, { sourceOrgId, targetOrgId });
            sendResponse(res, 500, false, 'Failed to retrieve load status');
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

    else if (action === 'get-load-plan') {
        const sourceOrgId = req.headers.sourceorgid;
        const targetOrgId = req.headers.targetorgid;
        if (!sourceOrgId || !targetOrgId) {
            return sendResponse(res, 400, false, 'Source and target Org IDs are required');
        }
        try {
            const loadPlan = await dependencyService.getLoadPlan(sourceOrgId, targetOrgId);
            sendResponse(res, 200, true, 'Load plan retrieved successfully', loadPlan);
        } catch (error) {
            log.error('Failed to build load plan', error, { sourceOrgId, targetOrgId });
            sendResponse(res, 500, false, 'Failed to build load plan');
        }
    }

    else if (action === 'get-migration-setting') {
        const sourceObjectId = req.headers.sourceobjectid;
        const targetObjectId = req.headers.targetobjectid;
        if (!sourceObjectId || !targetObjectId) {
            return sendResponse(res, 400, false, 'Source and target object IDs are required');
        }
        try {
            const setting = await migrationSettingService.getSetting(sourceObjectId, targetObjectId);
            sendResponse(res, 200, true, 'Migration setting retrieved successfully', setting);
        } catch (error) {
            log.error('Failed to retrieve migration setting', error, { sourceObjectId, targetObjectId });
            sendResponse(res, 500, false, 'Failed to retrieve migration setting');
        }
    }

    else if (action === 'get-extraction-preview') {
        const sourceOrgId = req.headers.sourceorgid;
        const targetOrgId = req.headers.targetorgid || null;
        if (!sourceOrgId) {
            return sendResponse(res, 400, false, 'sourceOrgId is required');
        }
        try {
            const preview = await extractionService.getExtractionPreview({ sourceOrgId, targetOrgId });
            sendResponse(res, 200, true, 'Extraction preview retrieved successfully', preview);
        } catch (error) {
            log.error('Failed to retrieve extraction preview', error, { sourceOrgId, targetOrgId });
            sendResponse(res, 500, false, error.message || 'Failed to retrieve extraction preview');
        }
    }

    else if (action === 'get-source-extract-filter') {
        const sourceObjectId = req.headers.sourceobjectid;
        if (!sourceObjectId) {
            return sendResponse(res, 400, false, 'sourceObjectId is required');
        }
        try {
            const filter = await sourceObjectFilterService.getExtractFilter(sourceObjectId);
            sendResponse(res, 200, true, 'Extract filter retrieved', { sourceObjectId, extractFilter: filter });
        } catch (error) {
            log.error('Failed to retrieve source extract filter', error, { sourceObjectId });
            sendResponse(res, 500, false, error.message || 'Failed to retrieve extract filter');
        }
    }

    else if (action === 'validate-object-mapping') {
        const sourceObjectId = req.headers.sourceobjectid;
        const targetObjectId = req.headers.targetobjectid;
        if (!sourceObjectId || !targetObjectId) {
            return sendResponse(res, 400, false, 'Source and target object IDs are required');
        }
        try {
            const result = await validationService.validateObjectMapping(sourceObjectId, targetObjectId);
            sendResponse(res, 200, true, 'Object mapping validated successfully', result);
        } catch (error) {
            log.error('Failed to validate object mapping', error, { sourceObjectId, targetObjectId });
            sendResponse(res, 500, false, 'Failed to validate object mapping');
        }
    }

    else if (action === 'get-upsert-config') {
        const targetObjectId = req.headers.targetobjectid;
        const sourceObjectId = req.headers.sourceobjectid;
        if (!targetObjectId) {
            return sendResponse(res, 400, false, 'Target object ID is required');
        }
        try {
            const candidates = await tracebackService.listExternalIdCandidates(targetObjectId);
            let config = { upsertExternalId: null, operation: 'upsert' };
            if (sourceObjectId) {
                config = await tracebackService.getUpsertConfig(sourceObjectId, targetObjectId);
            }
            sendResponse(res, 200, true, 'Upsert config retrieved successfully', {
                externalIdCandidates: candidates,
                ...config,
            });
        } catch (error) {
            log.error('Failed to retrieve upsert config', error, { targetObjectId });
            sendResponse(res, 500, false, error.message || 'Failed to retrieve upsert config');
        }
    }

    else if (action === 'get-load-records') {
        const targetOrgId = req.headers.targetorgid;
        const targetObjectName = req.headers.targetobjectname;
        const status = req.headers.status;
        const limit = req.headers.limit;
        if (!targetOrgId || !targetObjectName) {
            return sendResponse(res, 400, false, 'targetOrgId and targetObjectName are required');
        }
        try {
            const records = await loadService.getLoadRecords({
                targetOrgId,
                targetObjectName,
                status: status || 'all',
                limit: limit ? Number(limit) : 500,
            });
            sendResponse(res, 200, true, 'Load records retrieved successfully', records);
        } catch (error) {
            log.error('Failed to retrieve load records', error, { targetOrgId, targetObjectName });
            sendResponse(res, 500, false, error.message || 'Failed to retrieve load records');
        }
    }

    else if (action === 'download-load-csv') {
        const targetOrgId = req.headers.targetorgid;
        const runId = req.headers.runid;
        const objectName = req.headers.objectname;
        const type = req.headers.type === 'success' ? 'success' : 'error';
        if (!targetOrgId || !runId || !objectName) {
            return sendResponse(res, 400, false, 'targetOrgId, runId and objectName are required');
        }
        try {
            const filePath = await loadService.resolveLoadCsvPath({ targetOrgId, runId, objectName, type });
            if (!filePath) {
                return sendResponse(res, 404, false, 'CSV file not found');
            }
            const downloadName = `${objectName}_${type === 'success' ? 'success' : 'errors'}.csv`;
            res.download(filePath, downloadName);
        } catch (error) {
            log.error('Failed to download load CSV', error, { targetOrgId, runId, objectName });
            sendResponse(res, 400, false, error.message || 'Failed to download load CSV');
        }
    }

    else if (action === 'get-extraction-results') {
        const sourceOrgId = req.headers.sourceorgid;
        const targetOrgId = req.headers.targetorgid || null;
        if (!sourceOrgId) {
            return sendResponse(res, 400, false, 'sourceOrgId is required');
        }
        try {
            const results = await extractionService.getExtractionResults(sourceOrgId, targetOrgId);
            sendResponse(res, 200, true, 'Extraction results retrieved successfully', results);
        } catch (error) {
            log.error('Failed to retrieve extraction results', error, { sourceOrgId });
            sendResponse(res, 500, false, error.message || 'Failed to retrieve extraction results');
        }
    }

    else if (action === 'download-extraction-csv') {
        const sourceOrgId = req.headers.sourceorgid;
        const objectName = req.headers.objectname;
        if (!sourceOrgId || !objectName) {
            return sendResponse(res, 400, false, 'sourceOrgId and objectName are required');
        }
        try {
            const csv = await extractionService.resolveExtractionCsvData(sourceOrgId, objectName);
            if (csv === null) {
                return sendResponse(res, 404, false, 'No extraction data found for this object');
            }
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${objectName}_extracted.csv"`);
            res.send(csv);
        } catch (error) {
            log.error('Failed to download extraction CSV', error, { sourceOrgId, objectName });
            sendResponse(res, 500, false, error.message || 'Failed to download extraction CSV');
        }
    }

    else if (action === 'download-transform-csv') {
        const targetOrgId = req.headers.targetorgid;
        const objectName = req.headers.objectname;
        if (!targetOrgId || !objectName) {
            return sendResponse(res, 400, false, 'targetOrgId and objectName are required');
        }
        try {
            const csv = await transformService.resolveTransformCsvData(targetOrgId, objectName);
            if (csv === null) {
                return sendResponse(res, 404, false, 'No transform data found for this object');
            }
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${objectName}_transformed.csv"`);
            res.send(csv);
        } catch (error) {
            log.error('Failed to download transform CSV', error, { targetOrgId, objectName });
            sendResponse(res, 500, false, error.message || 'Failed to download transform CSV');
        }
    }

    else if (action === 'export-mappings-csv') {
        const sourceOrgId = req.headers.sourceorgid;
        const targetOrgId = req.headers.targetorgid;
        if (!sourceOrgId || !targetOrgId) {
            return sendResponse(res, 400, false, 'sourceOrgId and targetOrgId are required');
        }
        try {
            const csv = await mappingService.exportMappingsCsv(sourceOrgId, targetOrgId);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="mappings.csv"');
            res.send(csv);
        } catch (error) {
            log.error('Failed to export mappings CSV', error, { sourceOrgId, targetOrgId });
            sendResponse(res, 500, false, error.message || 'Failed to export mappings CSV');
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
                .then(async () => {
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
        const { sourceOrgId, targetOrgId, sourceObjectIds } = req.body;
        if (!sourceOrgId && !targetOrgId) {
            return sendResponse(res, 400, false, 'sourceOrgId or targetOrgId is required');
        }

        const extractionMode = sourceOrgId ? 'source-org' : 'target-org';
        const isSubset = Array.isArray(sourceObjectIds) && sourceObjectIds.length > 0;
        log.info('Extraction request received', { extractionMode, sourceOrgId, targetOrgId, subsetSize: isSubset ? sourceObjectIds.length : null });

        try {
            // Set extraction status to running
            const orgId = sourceOrgId || targetOrgId;
            await orgRepo.update(orgId, {
                extractionStatus: 'running',
                extractionSummary: null,
                extractionError: null,
            });

            // Return 202 immediately
            sendResponse(res, 202, true, 'Extraction started', { extractionStatus: 'running' });

            // Run extraction in background
            const extractionPromise = sourceOrgId
                ? extractionService.runExtraction({
                    sourceOrgId,
                    targetOrgId: targetOrgId || null,
                    sourceObjectIds: isSubset ? sourceObjectIds : null,
                })
                : extractionService.runExtractionForTargetOrg({ targetOrgId });

            extractionPromise
                .then(async (summary) => {
                    log.info('Extraction completed', {
                        extractionMode,
                        sourceOrgId,
                        targetOrgId,
                        totalObjects: summary.totalObjects,
                        successCount: summary.successCount,
                        failedCount: summary.failedCount,
                    });
                    await orgRepo.update(orgId, {
                        extractionStatus: 'complete',
                        extractionSummary: summary,
                        extractionError: null,
                    });
                })
                .catch(async (error) => {
                    log.error('Extraction failed', error, { extractionMode, sourceOrgId, targetOrgId });

                    // Check if it's an auth error
                    const isAuthError = error.message?.includes('Authentication failed') ||
                                      error.message?.includes('access token') ||
                                      error.name === 'OAuthRequiredError';

                    await orgRepo.update(orgId, {
                        extractionStatus: isAuthError ? 'auth_failed' : 'failed',
                        extractionSummary: null,
                        extractionError: error.message || 'Extraction failed',
                    });
                });
        } catch (error) {
            const orgId = sourceOrgId || targetOrgId;
            log.error('Failed to start extraction', error, { extractionMode, sourceOrgId, targetOrgId });
            await orgRepo.update(orgId, {
                extractionStatus: 'failed',
                extractionError: error.message || 'Failed to start extraction',
            }).catch(() => {});
            sendResponse(res, 500, false, error.message || 'Failed to start extraction');
        }
    }

    else if (action === 'start-transform') {
        const { sourceOrgId, targetOrgId } = req.body;
        if (!sourceOrgId || !targetOrgId) {
            return sendResponse(res, 400, false, 'sourceOrgId and targetOrgId are required');
        }

        log.info('Transform request received', { sourceOrgId, targetOrgId });

        try {
            transformService.setTransformStatus(sourceOrgId, targetOrgId, { status: 'running', summary: null, error: null });

            // Return 202 immediately; run the transform in the background.
            sendResponse(res, 202, true, 'Transform started', { transformStatus: 'running' });

            transformService.runTransform({ sourceOrgId, targetOrgId })
                .then((summary) => {
                    log.info('Transform completed', {
                        sourceOrgId,
                        targetOrgId,
                        targetObjectCount: summary.targetObjectCount,
                        successCount: summary.successCount,
                        failedCount: summary.failedCount,
                    });
                    transformService.setTransformStatus(sourceOrgId, targetOrgId, { status: 'complete', summary, error: null });
                })
                .catch((error) => {
                    log.error('Transform failed', error, { sourceOrgId, targetOrgId });
                    transformService.setTransformStatus(sourceOrgId, targetOrgId, { status: 'failed', summary: null, error: error.message || 'Transform failed' });
                });
        } catch (error) {
            log.error('Failed to start transform', error, { sourceOrgId, targetOrgId });
            transformService.setTransformStatus(sourceOrgId, targetOrgId, { status: 'failed', summary: null, error: error.message || 'Failed to start transform' });
            sendResponse(res, 500, false, error.message || 'Failed to start transform');
        }
    }

    else if (action === 'start-load') {
        const { sourceOrgId, targetOrgId } = req.body;
        if (!sourceOrgId || !targetOrgId) {
            return sendResponse(res, 400, false, 'sourceOrgId and targetOrgId are required');
        }

        log.info('Load request received', { sourceOrgId, targetOrgId });

        try {
            loadService.setLoadStatus(sourceOrgId, targetOrgId, { status: 'running', summary: null, error: null });

            // Return 202 immediately; run the load in the background.
            sendResponse(res, 202, true, 'Load started', { loadStatus: 'running' });

            loadService.runLoad({ sourceOrgId, targetOrgId })
                .then((summary) => {
                    log.info('Load completed', {
                        sourceOrgId,
                        targetOrgId,
                        objectCount: summary.objectCount,
                    });
                    loadService.setLoadStatus(sourceOrgId, targetOrgId, { status: 'complete', summary, error: null });
                })
                .catch((error) => {
                    log.error('Load failed', error, { sourceOrgId, targetOrgId });
                    loadService.setLoadStatus(sourceOrgId, targetOrgId, { status: 'failed', summary: null, error: error.message || 'Load failed' });
                });
        } catch (error) {
            log.error('Failed to start load', error, { sourceOrgId, targetOrgId });
            loadService.setLoadStatus(sourceOrgId, targetOrgId, { status: 'failed', summary: null, error: error.message || 'Failed to start load' });
            sendResponse(res, 500, false, error.message || 'Failed to start load');
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

    else if (action === 'upsert-migration-setting') {
        const { sourceObjectId, targetObjectId, ...updates } = req.body;
        if (!sourceObjectId || !targetObjectId) {
            return sendResponse(res, 400, false, 'Source and target object IDs are required');
        }
        try {
            const setting = await migrationSettingService.upsertSetting(sourceObjectId, targetObjectId, updates);
            sendResponse(res, 200, true, 'Migration setting saved successfully', setting);
        } catch (error) {
            log.error('Failed to save migration setting', error, { sourceObjectId, targetObjectId });
            sendResponse(res, 500, false, error.message || 'Failed to save migration setting');
        }
    }

    else if (action === 'set-source-extract-filter') {
        const { sourceObjectId, extractFilter } = req.body;
        if (!sourceObjectId) {
            return sendResponse(res, 400, false, 'sourceObjectId is required');
        }
        try {
            const saved = await sourceObjectFilterService.setExtractFilter(sourceObjectId, extractFilter);
            sendResponse(res, 200, true, 'Extract filter saved', { sourceObjectId, extractFilter: saved });
        } catch (error) {
            log.error('Failed to save source extract filter', error, { sourceObjectId });
            sendResponse(res, 500, false, error.message || 'Failed to save extract filter');
        }
    }

    else if (action === 'set-upsert-config') {
        const { sourceObjectId, targetObjectId, externalIdFieldId, operation } = req.body;
        if (!sourceObjectId || !targetObjectId) {
            return sendResponse(res, 400, false, 'Source and target object IDs are required');
        }
        try {
            const results = {};
            if (operation !== undefined) {
                results.operation = await tracebackService.setOperation(sourceObjectId, targetObjectId, operation);
            }
            if (externalIdFieldId !== undefined) {
                results.upsertExternalId = await tracebackService.setUpsertExternalId(
                    sourceObjectId, targetObjectId, externalIdFieldId || null,
                );
            }
            sendResponse(res, 200, true, 'Upsert configuration saved successfully', results);
        } catch (error) {
            log.error('Failed to save upsert configuration', error, { sourceObjectId, targetObjectId });
            sendResponse(res, 500, false, error.message || 'Failed to save upsert configuration');
        }
    }

    else if (action === 'import-mappings-csv') {
        const { sourceOrgId, targetOrgId, rows } = req.body;
        if (!sourceOrgId || !targetOrgId || !Array.isArray(rows)) {
            return sendResponse(res, 400, false, 'sourceOrgId, targetOrgId and rows array are required');
        }
        try {
            const result = await mappingService.importMappingsCsv(sourceOrgId, targetOrgId, rows);
            sendResponse(res, 200, true, `Import complete: ${result.created} created, ${result.skipped} skipped`, result);
        } catch (error) {
            log.error('Failed to import mappings CSV', error, { sourceOrgId, targetOrgId });
            sendResponse(res, 500, false, error.message || 'Failed to import mappings CSV');
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
