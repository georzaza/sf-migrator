/**
 * Record Expansion Service - business logic + validation for object-level
 * explode (record multiplication) transforms. Each variant produces one target
 * row; its field values and optional filter are transform trees validated by the
 * shared node registry. See SERVER/src/utils/transformTree.js.
 */

import recordExpansionRepo from '../repositories/recordExpansionRepository.js';
import metadataRepo from '../repositories/metadataRepository.js';
import logger from '../lib/logger.js';
import { validateTransform } from '../utils/transformTree.js';

const log = logger.create('recordExpansionService');

/**
 * Validate the variants array. Throws on structural or tree errors.
 */
function validateVariants(variants) {
    if (!Array.isArray(variants) || variants.length === 0) {
        throw new Error('At least one variant is required');
    }

    variants.forEach((variant, i) => {
        if (!variant || typeof variant !== 'object') {
            throw new Error(`Variant ${i} must be an object`);
        }
        if (!variant.fields || typeof variant.fields !== 'object' || Array.isArray(variant.fields)) {
            throw new Error(`Variant ${i} requires a "fields" object`);
        }
        const fieldNames = Object.keys(variant.fields);
        if (fieldNames.length === 0) {
            throw new Error(`Variant ${i} must map at least one target field`);
        }
        for (const name of fieldNames) {
            try {
                validateTransform(variant.fields[name]);
            } catch (err) {
                throw new Error(`Variant ${i} field "${name}": ${err.message}`);
            }
        }
        if (variant.filter !== undefined && variant.filter !== null) {
            try {
                validateTransform(variant.filter);
            } catch (err) {
                throw new Error(`Variant ${i} filter: ${err.message}`);
            }
        }
    });
}

async function getByOrgPair(sourceOrgId, targetOrgId) {
    return recordExpansionRepo.findByOrgPair(sourceOrgId, targetOrgId);
}

async function getBySourceOrg(sourceOrgId) {
    return recordExpansionRepo.findBySourceOrg(sourceOrgId);
}

async function upsertExpansion(sourceObjectId, targetObjectId, variants) {
    const sourceObject = await metadataRepo.findObjectById(sourceObjectId);
    const targetObject = await metadataRepo.findObjectById(targetObjectId);
    if (!sourceObject) throw new Error(`Source object not found: ${sourceObjectId}`);
    if (!targetObject) throw new Error(`Target object not found: ${targetObjectId}`);

    validateVariants(variants);

    const saved = await recordExpansionRepo.upsert(sourceObjectId, targetObjectId, variants);
    // log.info('Record expansion saved', { id: saved.id, sourceObjectId, targetObjectId, variantCount: variants.length });
    return saved;
}

async function deleteExpansion(id) {
    return recordExpansionRepo.remove(id);
}

export default {
    validateVariants,
    getByOrgPair,
    getBySourceOrg,
    upsertExpansion,
    deleteExpansion,
};
