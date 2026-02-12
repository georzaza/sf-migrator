/**
 * Metadata Service
 *
 * Orchestrates Salesforce API calls and database storage for metadata.
 * DB operations are delegated to metadataRepository.
 */

const metadataRepo = require('../repositories/metadataRepository');
const salesforceService = require('./salesforceService');
const logger = require('../lib/logger');
const log = logger.create('metadataService');
const standardObjectFilters = require('./config/objectsToExclude');

/**
 * Analyze org and save metadata to database
 */
async function analyzeAndSaveOrg(sfOrgId, options = {}) {
    const {
        objectsToAnalyze = null,
        includeCustomOnly = false,
    } = options;

    try {
        const objects = await salesforceService.describeGlobal(sfOrgId, filters = {});
        log.info('Retrieved global objects from Salesforce', { count: objects.length });

        // user filters
        const objectsFilteredByUserPrefs = objectsToAnalyze
            ? objects.filter(obj => objectsToAnalyze.includes(obj.objectName))
            : objects;
        log.info('Object filters applied (user preferences). New count is ', { count: objectsFilteredByUserPrefs.length });

        // hardcoded filters applied on top of the user preferences
        let objectsToProcess = objectsFilteredByUserPrefs
            .filter(obj => !standardObjectFilters.hardcodedList.includes(obj.objectName));
        log.info('Object filters applied (hardcoded list). New count is ', { count: objectsToProcess.length });

        objectsToProcess = objectsToProcess
            .filter(obj => !standardObjectFilters.patternList.some(pattern => pattern.test(obj.objectName)));
        log.info('Object filters applied (pattern list). New count is ', { count: objectsToProcess.length });

        const savedObjects = [];
        let totalFields = 0;

        let i=0;
        for (const objMetadata of objectsToProcess) {

            const recordCount = await salesforceService.getRecordCount(
                sfOrgId,
                objMetadata.objectName
            );

            const detailedMetadata = await salesforceService.describeObject(
                sfOrgId,
                objMetadata.objectName
            );

            const savedObject = await saveObjectMetadata(sfOrgId, {
                ...detailedMetadata,
                recordCount,
            });

            savedObjects.push(savedObject);
            totalFields += detailedMetadata.fields.length;
            if (++i>20) {
                break;
            }
        }
        log.toFile('describeObject', {fetched: savedObjects});

        return {
            success: true,
            objectsAnalyzed: savedObjects.length,
            totalFields,
            objects: savedObjects,
        };
    } catch (error) {
        log.error('Error while issuing describe calls.', error, { sfOrgId: sfOrgId });
        throw error;
    }
}

/**
 * Save object metadata to database (with fields)
 */
async function saveObjectMetadata(sfOrgId, metadata) {
    try {
        const objectMetadata = await metadataRepo.findOrCreateObject(sfOrgId, metadata);

        if (metadata.fields && metadata.fields.length > 0) {
            await saveFieldMetadata(objectMetadata.id, metadata.fields);
        }

        return await metadataRepo.findObjectById(objectMetadata.id, { includeFields: true });
    } catch (error) {
        // Error already logged at source or will be logged at top level, just re-throw
        throw error;
    }
}

/**
 * Save field metadata for an object
 */
async function saveFieldMetadata(objectMetadataId, fields) {
    try {
        const savedFields = [];

        for (const field of fields) {
            const fieldMetadata = await metadataRepo.findOrCreateField(objectMetadataId, field);
            savedFields.push(fieldMetadata);
        }

        return savedFields;
    } catch (error) {
        // Error already logged at source or will be logged at top level, just re-throw
        throw error;
    }
}

/**
 * Get all objects for an org from database
 */
async function getObjectsForOrg(sfOrgId, options = {}) {
    const { includeFields = false } = options;

    try {
        return await metadataRepo.findObjectsByOrgId(sfOrgId, { includeFields });
    } catch (error) {
        log.error('Failed to get objects for org', error, { sfOrgId });
        throw error;
    }
}

/**
 * Get fields for a specific object
 */
async function getFieldsForObject(objectMetadataId) {
    try {
        return await metadataRepo.findFieldsByObjectId(objectMetadataId);
    } catch (error) {
        log.error('Failed to get fields for object', error, { objectMetadataId });
        throw error;
    }
}

/**
 * Refresh metadata for an org (re-analyze)
 */
async function refreshMetadata(sfOrgId, options = {}) {
    return analyzeAndSaveOrg(sfOrgId, options);
}

/**
 * Delete all metadata for an org
 */
async function deleteOrgMetadata(sfOrgId) {
    try {
        const deletedCount = await metadataRepo.deleteObjectsByOrgId(sfOrgId);
        return { success: true, deletedObjects: deletedCount };
    } catch (error) {
        log.error('Failed to delete org metadata', error, { sfOrgId });
        throw error;
    }
}

/**
 * Get metadata statistics for an org
 */
async function getMetadataStats(sfOrgId) {
    try {
        return await metadataRepo.getStats(sfOrgId);
    } catch (error) {
        log.error('Failed to get metadata stats', error, { sfOrgId });
        throw error;
    }
}

module.exports = {
    analyzeAndSaveOrg,
    saveObjectMetadata,
    saveFieldMetadata,
    getObjectsForOrg,
    getFieldsForObject,
    refreshMetadata,
    deleteOrgMetadata,
    getMetadataStats,
};
