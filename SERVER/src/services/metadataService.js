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

async function analyzeAndSaveOrg(sfOrgId, options = {}) {
    const {
        objectsToAnalyze = null,
        includeCustomOnly = false,
    } = options;

    try {
        const objects = await sfService.describeGlobal(sfOrgId, filters = {});
        log.debug('Retrieved global object describes', { orgId: sfOrgId, "objects count": objects.length });

        // user filters
        let objectsToProcess = objectsToAnalyze
            ? objects.filter(obj => objectsToAnalyze.includes(obj.name))
            : objects;
        log.debug('Object filters applied.', { type: 'user filter', "new objects count": objectsToProcess.length });

        // hardcoded filters
        objectsToProcess = objectsToProcess
            .filter(obj => !standardObjectFilters.hardcodedList.includes(obj.name));
        log.debug('Object filters applied.', { type: 'hardcoded', "new objects count": objectsToProcess.length });

        // pattern filters
        objectsToProcess = objectsToProcess
            .filter(obj => !standardObjectFilters.patternList.some(pattern => pattern.test(obj.name)));
        log.debug('Object filters applied.', { type: 'patterns', "new objects count": objectsToProcess.length });

        // delegate to salesforce service, where Composite API will speed up requests.
        const sobjectDescribes = await sfService.describeObjectMultiple(
            sfOrgId,
            objectsToProcess.map(obj => obj.name)
        );
        log.toFile('sobjectDescribes', sobjectDescribes);

        // write both objects & fields to db
        const savedObjects = await metadataRepo.bulkUpsertObjects(sfOrgId, sobjectDescribes);
        const objectIdMap = new Map(savedObjects.map(obj => [obj.name, obj.id]));
        const fields = sobjectDescribes.flatMap(describe =>
            describe.fields.map(field => ({
                ...field,
                objectMetadataId: objectIdMap.get(describe.name),
            }))
        );
        await metadataRepo.bulkUpsertFields(fields);
        log.debug('Describes completed. Results written to database', {
            sfOrgId,
            describedObjects: sobjectDescribes.length,
            describedFields: fields.length,
        });
        log.toFile('sobjectDescribes_savedObjects', savedObjects);
        return {
            objectsAnalyzed: sobjectDescribes.length
        }
    } catch (error) {
        error.sfOrgId = sfOrgId;
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
