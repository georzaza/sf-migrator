/**
 * Metadata Service
 *
 * Orchestrates Salesforce API calls and database storage for metadata.
 * DB operations are delegated to metadataRepository.
 */

const metadataRepo = require('../repositories/metadataRepository');
const sfService = require('./salesforceService');
const logger = require('../lib/logger');
const log = logger.create('metadataService');
const standardObjectFilters = require('./config/objectsToExclude');


// todo async function analyzeAndSaveOrg(sfOrgId, options = {}, progressCallback = null) {
async function analyzeAndSaveOrg(sfOrgId, options = {}) {
    const {
        objectsToAnalyze = null,
        includeCustomOnly = false,
    } = options;

    try {
        const objects = await sfService.describeGlobal(sfOrgId, filters = {});
        log.info('Retrieved global objects from Salesforce', { count: objects.length });

        // user filters
        const objectsFilteredByUserPrefs = objectsToAnalyze
            ? objects.filter(obj => objectsToAnalyze.includes(obj.objectName))
            : objects;
        log.info('Object filters applied (user preferences). New count is ', { count: objectsFilteredByUserPrefs.length });

        // hardcoded filters applied on top of user preferences - hardcoded list
        let objectsToProcess = objectsFilteredByUserPrefs
            .filter(obj => !standardObjectFilters.hardcodedList.includes(obj.objectName));
        log.info('Object filters applied (hardcoded list). New count is ', { count: objectsToProcess.length });

        // hardcoded filters applied on top of user preferences - patterns
        objectsToProcess = objectsToProcess
            .filter(obj => !standardObjectFilters.patternList.some(pattern => pattern.test(obj.objectName)));
        log.info('Object filters applied (pattern list). New count is ', { count: objectsToProcess.length });

        // for logging only
        const savedObjects = [];
        let totalFields = 0;

        // delegate to salesforce service, where Composite API will speed up requests.
        const sobjectDescribes = await sfService.describeObjectMultiple(
            sfOrgId,
            objectsToProcess.map(obj => obj.objectName)
        );
        log.toFile('describeObjects', sobjectDescribes);

        for (const sobjDescribe of sobjectDescribes) {
            const savedObj = await saveObjectMetadata(sfOrgId, sobjDescribe);
            savedObjects.push(savedObj);
            totalFields += sobjDescribe?.fields?.length ?? 0;
        }
        log.toFile('describeObject', JSON.stringify(savedObjects, null, 2));

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


async function getObjectsForOrg(sfOrgId, options = {}) {
    const { includeFields = false } = options;

    try {
        return await metadataRepo.findObjectsByOrgId(sfOrgId, { includeFields });
    } catch (error) {
        log.error('Failed to get objects for org', error, { sfOrgId });
        throw error;
    }
}


async function getFieldsForObject(objectMetadataId) {
    try {
        return await metadataRepo.findFieldsByObjectId(objectMetadataId);
    } catch (error) {
        log.error('Failed to get fields for object', error, { objectMetadataId });
        throw error;
    }
}


async function deleteOrgMetadata(sfOrgId) {
    try {
        const deletedCount = await metadataRepo.deleteObjectsByOrgId(sfOrgId);
        return { success: true, deletedObjects: deletedCount };
    } catch (error) {
        log.error('Failed to delete org metadata', error, { sfOrgId });
        throw error;
    }
}


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
    deleteOrgMetadata,
    getMetadataStats,
};
