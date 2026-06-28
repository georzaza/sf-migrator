/**
 * Relationship Resolver
 *
 * Resolves and validates transformation field references against the metadata
 * stored in our DB, traversing relationship fields via `relationshipName` and
 * `referenceTo`.
 *
 * Example reference: "Account.Contact.Owner.Id"
 *   - "Account"  -> root object (resolved by name within the source org)
 *   - "Contact"  -> a field on Account whose relationshipName is "Contact"
 *                   (its referenceTo points to the Contact object)
 *   - "Owner"    -> a field on Contact whose relationshipName is "Owner"
 *                   (its referenceTo points to the User object)
 *   - "Id"       -> a field named "Id" on User (the leaf)
 *
 * Validation outcomes per reference:
 *   - ok        : every segment resolved
 *   - error     : a relationship/field segment does not exist (caller blocks)
 *   - warning   : a referenced object is not yet in our metadata DB; a
 *                 background describe is triggered and validation stops there
 *   - skipped   : a polymorphic relationship (referenceTo > 1) was hit; deeper
 *                 validation is intentionally skipped (resolved at runtime via
 *                 record keyPrefix during the transformation phase)
 *
 * This module is also intended for reuse during the transformation phase.
 */

import metadataRepo from '../repositories/metadataRepository.js';
import metadataService from './metadataService.js';
import sfService from './salesforceService.js';
import { parseTransformationRule, extractReferencedFields } from '../utils/transformationRule.js';
import logger from '../lib/logger.js';

const log = logger.create('relationshipResolver');

/**
 * Fire-and-forget describe of a single object that is missing from our DB.
 * Best-effort: failures (e.g. no active connection) are logged, not thrown.
 */
function triggerBackgroundDescribe(sfOrgId, objectName) {
    Promise.resolve()
        .then(async () => {
            log.info('Background describe started for missing object', { sfOrgId, objectName });
            const describe = await sfService.describeObject(sfOrgId, objectName);
            await metadataService.saveObjectMetadata(sfOrgId, describe);
            log.info('Background describe completed', { sfOrgId, objectName });
        })
        .catch((error) => {
            log.warn('Background describe failed', { sfOrgId, objectName, message: error.message });
        });
}

/**
 * Build a per-call lookup context for an org: objects keyed by lower-cased name,
 * plus a lazy per-object field cache.
 */
async function buildOrgContext(sfOrgId) {
    const objects = await metadataRepo.findObjectsByOrgId(sfOrgId);
    const objectsByName = new Map();
    for (const obj of objects) {
        objectsByName.set(obj.name.toLowerCase(), obj);
    }
    return { sfOrgId, objectsByName, fieldCache: new Map() };
}

async function getFields(ctx, objectMetadataId) {
    if (ctx.fieldCache.has(objectMetadataId)) {
        return ctx.fieldCache.get(objectMetadataId);
    }
    const fields = await metadataRepo.findFieldsByObjectId(objectMetadataId);
    ctx.fieldCache.set(objectMetadataId, fields);
    return fields;
}

function findRelationshipField(fields, segment) {
    const target = segment.toLowerCase();
    return fields.find(f => f.relationshipName && f.relationshipName.toLowerCase() === target);
}

function findNamedField(fields, segment) {
    const target = segment.toLowerCase();
    return fields.find(f => f.name && f.name.toLowerCase() === target);
}

/**
 * Validate a single dotted reference string against the org metadata.
 * Returns one of: { ok }, { error }, { warning }, { skipped }.
 */
async function validatePath(ctx, refString) {
    const segments = refString.split('.');
    if (segments.length < 2) {
        return { error: `Invalid field reference "${refString}": expected at least Object.Field.` };
    }

    const [rootName, ...rest] = segments;

    let currentObject = ctx.objectsByName.get(rootName.toLowerCase());
    if (!currentObject) {
        triggerBackgroundDescribe(ctx.sfOrgId, rootName);
        return {
            warning: `Referenced object "${rootName}" has not been analyzed yet. Fetching its metadata in the background — re-validate shortly.`,
        };
    }

    // Intermediate segments are relationships; traverse via referenceTo.
    for (let i = 0; i < rest.length - 1; i++) {
        const segment = rest[i];
        const fields = await getFields(ctx, currentObject.id);
        const relField = findRelationshipField(fields, segment);

        if (!relField) {
            return { error: `Unknown relationship "${segment}" on object "${currentObject.name}" in "${refString}".` };
        }

        const refs = Array.isArray(relField.referenceTo) ? relField.referenceTo : [];
        if (refs.length === 0) {
            return { error: `Field "${segment}" on "${currentObject.name}" is not a relationship field in "${refString}".` };
        }
        if (refs.length > 1) {
            // Polymorphic relationship — resolved at runtime via record keyPrefix.
            log.debug('Skipping deeper validation through polymorphic relationship', {
                object: currentObject.name,
                relationship: segment,
                referenceTo: refs,
                refString,
            });
            return { skipped: true };
        }

        const nextName = refs[0];
        const nextObject = ctx.objectsByName.get(nextName.toLowerCase());
        if (!nextObject) {
            triggerBackgroundDescribe(ctx.sfOrgId, nextName);
            return {
                warning: `Referenced object "${nextName}" (via "${segment}") has not been analyzed yet. Fetching its metadata in the background — re-validate shortly.`,
            };
        }
        currentObject = nextObject;
    }

    // Leaf segment must be an actual field name on the current object.
    const leaf = rest[rest.length - 1];
    const fields = await getFields(ctx, currentObject.id);
    if (!findNamedField(fields, leaf)) {
        return { error: `Unknown field "${leaf}" on object "${currentObject.name}" in "${refString}".` };
    }

    return { ok: true };
}

/**
 * Parse a transformation rule, extract its referenced fields, and validate each
 * against the org metadata.
 *
 * Throws an Error (with code 'transformation-reference-invalid') on the first
 * non-existent relationship/field. Returns advisory warnings for references
 * that could not be fully verified (missing object metadata).
 *
 * @param {string} sfOrgId            Source org id the references resolve within
 * @param {string} transformationRule The raw expression rule (e.g. "{Account.Name}")
 * @returns {Promise<{ warnings: Array<{ code: string, message: string }> }>}
 */
async function validateTransformationReferences(sfOrgId, transformationRule) {
    const warnings = [];

    const ast = parseTransformationRule(transformationRule);
    const refStrings = [...extractReferencedFields(ast)];
    if (refStrings.length === 0) {
        return { warnings };
    }

    const ctx = await buildOrgContext(sfOrgId);

    for (const refString of refStrings) {
        const result = await validatePath(ctx, refString);
        if (result.error) {
            const error = new Error(result.error);
            error.code = 'transformation-reference-invalid';
            throw error;
        }
        if (result.warning) {
            warnings.push({ code: 'transformation-reference-unverified', message: result.warning });
        }
    }

    log.debug('Transformation references validated', {
        sfOrgId,
        referenceCount: refStrings.length,
        warningCount: warnings.length,
    });

    return { warnings };
}

export default {
    validateTransformationReferences,
};
