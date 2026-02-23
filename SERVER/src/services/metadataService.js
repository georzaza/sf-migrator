/**
 * Metadata Service
 *
 * Orchestrates Salesforce API calls and database storage for metadata.
 * DB operations are delegated to metadataRepository.
 */

import mdtRepo from '../repositories/metadataRepository.js';
import sfService from './salesforceService.js';
import standardObjectFilters from '../excludedObjects.js';
import logger from '../lib/logger.js';
const log = logger.create('metadataService');

async function analyzeAndSaveOrg(sfOrgId, options = {}) {
    const {
        objectsToAnalyze = null,
        includeCustomOnly = false,
    } = options;
    return null;
    try {
        const objects = await sfService.describeGlobal(sfOrgId);
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
        const savedObjects = await mdtRepo.bulkUpsertObjects(sfOrgId, sobjectDescribes);
        const objectIdMap = new Map(savedObjects.map(obj => [obj.name, obj.id]));
        const fields = sobjectDescribes.flatMap(describe =>
            describe.fields.map(field => ({
                ...field,
                objectMetadataId: objectIdMap.get(describe.name),
            }))
        );
        await mdtRepo.bulkUpsertFields(fields);
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
        const objectMetadata = await mdtRepo.findOrCreateObject(sfOrgId, metadata);

        if (metadata.fields && metadata.fields.length > 0) {
            await saveFieldMetadata(objectMetadata.id, metadata.fields);
        }

        return await mdtRepo.findObjectById(objectMetadata.id, { includeFields: true });
    } catch (error) {
        // Error already logged at source or will be logged at top level, just re-throw
        throw error;
    }
}


async function saveFieldMetadata(objectMetadataId, fields) {
    try {
        const savedFields = [];

        for (const field of fields) {
            const fieldMetadata = await mdtRepo.findOrCreateField(objectMetadataId, field);
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
        return await mdtRepo.findObjectsByOrgId(sfOrgId, { includeFields });
    } catch (error) {
        log.error('Failed to get objects for org', error, { sfOrgId });
        throw error;
    }
}


async function getFieldsForObject(objectMetadataId) {
    try {
        return await mdtRepo.findFieldsByObjectId(objectMetadataId);
    } catch (error) {
        log.error('Failed to get fields for object', error, { objectMetadataId });
        throw error;
    }
}


async function deleteOrgMetadata(sfOrgId) {
    try {
        const deletedCount = await mdtRepo.deleteObjectsByOrgId(sfOrgId);
        return { success: true, deletedObjects: deletedCount };
    } catch (error) {
        log.error('Failed to delete org metadata', error, { sfOrgId });
        throw error;
    }
}


async function getMetadataStats(sfOrgId) {
    try {
        return await mdtRepo.getStats(sfOrgId);
    } catch (error) {
        log.error('Failed to get metadata stats', error, { sfOrgId });
        throw error;
    }
}

export default {
    analyzeAndSaveOrg,
    saveObjectMetadata,
    saveFieldMetadata,
    getObjectsForOrg,
    getFieldsForObject,
    deleteOrgMetadata,
    getMetadataStats,
};
