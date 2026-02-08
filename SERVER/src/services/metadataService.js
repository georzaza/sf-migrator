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

/**
 * Analyze org and save metadata to database
 */
async function analyzeAndSaveOrg(sfOrgId, options = {}) {
    const { includeRecordCounts = false, objectsToAnalyze = null } = options;

    try {
        const objects = await salesforceService.analyzeOrg(sfOrgId);

        const objectsToProcess = objectsToAnalyze
            ? objects.filter(obj => objectsToAnalyze.includes(obj.objectName))
            : objects;

        const savedObjects = [];
        let totalFields = 0;

        for (const objMetadata of objectsToProcess) {
            const detailedMetadata = await salesforceService.getObjectMetadata(
                sfOrgId,
                objMetadata.objectName
            );

            let recordCount = null;
            if (includeRecordCounts) {
                recordCount = await salesforceService.getRecordCount(
                    sfOrgId,
                    objMetadata.objectName
                );
            }

            const savedObject = await saveObjectMetadata(sfOrgId, {
                ...detailedMetadata,
                recordCount,
            });

            savedObjects.push(savedObject);
            totalFields += detailedMetadata.fields.length;
        }

        return {
            success: true,
            objectsAnalyzed: savedObjects.length,
            totalFields,
            objects: savedObjects,
        };
    } catch (error) {
        // Error already logged at source (salesforceService), just re-throw
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
