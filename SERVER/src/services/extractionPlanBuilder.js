/**
 * Extraction Plan Builder
 *
 * Derives the set of source-org objects (and per-object required fields) that
 * extraction must pull, driven STRICTLY by the field mappings that exist.
 *
 * Inputs:
 *   - sourceOrgId
 *   - fieldMappings: as returned by mappingRepository.findFieldMappingsBy*
 *     (must include `sourceObject`, `sourceField` associations)
 *   - metadataRepo: repositories/metadataRepository.js
 *
 * Output:
 *   {
 *     objects: [{ id, name, label }, ...],   // unique, includes intermediates
 *     fieldsByObjectId: Map<objectId, Set<fieldName>>  // always includes 'Id'
 *   }
 */

import logger from '../lib/logger.js';
import {
    parseTransformationRule,
    extractReferencedFields,
} from '../utils/transformationRule.js';

const log = logger.create('extractionPlanBuilder');

function extractReferenceTargetNames(referenceTo) {
    if (!Array.isArray(referenceTo) || referenceTo.length === 0) return [];
    const names = [];
    for (const ref of referenceTo) {
        let name = null;
        if (typeof ref === 'string') name = ref;
        else if (ref && typeof ref === 'object') {
            name = ref.objectApiName || ref.name || ref.sobject || ref.targetObjectName || null;
        }
        if (name && !names.includes(name)) names.push(name);
    }
    return names;
}

async function buildExtractionPlan({ sourceOrgId, fieldMappings, metadataRepo }) {
    if (!sourceOrgId) throw new Error('sourceOrgId is required');
    if (!metadataRepo) throw new Error('metadataRepo is required');
    const mappings = Array.isArray(fieldMappings) ? fieldMappings : [];

    log.info('Building extraction plan', { sourceOrgId, mappingCount: mappings.length });

    // Load source-org object index once
    const allObjects = await metadataRepo.findObjectsByOrgId(sourceOrgId);
    const objectsByName = new Map();
    const objectsById = new Map();
    for (const obj of allObjects) {
        const slim = { id: obj.id, name: obj.name, label: obj.label || null, extractFilter: obj.extractFilter ?? null };
        objectsByName.set(obj.name, slim);
        objectsById.set(obj.id, slim);
    }

    // Per-object metadata cache (objectId -> SfFieldMetadata[])
    const fieldsByObjectCache = new Map();
    async function getFields(objectId) {
        if (fieldsByObjectCache.has(objectId)) return fieldsByObjectCache.get(objectId);
        const fields = await metadataRepo.findFieldsByObjectId(objectId);
        fieldsByObjectCache.set(objectId, fields || []);
        return fieldsByObjectCache.get(objectId);
    }

    const planObjects = new Map();          // objectId -> { id, name, label }
    const requiredFields = new Map();        // objectId -> Set<fieldName>

    function ensureObject(obj) {
        if (!obj?.id) return;
        if (!planObjects.has(obj.id)) {
            planObjects.set(obj.id, obj);
            requiredFields.set(obj.id, new Set(['Id']));
        }
    }

    function addField(objectId, fieldName) {
        if (!objectId || !fieldName) return;
        const set = requiredFields.get(objectId);
        if (set) set.add(fieldName);
    }

    // 1) Seed every source object that appears in any mapping
    for (const m of mappings) {
        const so = m.sourceObject;
        if (!so?.id || !so?.name) continue;
        const cached = objectsById.get(so.id);
        ensureObject(cached || { id: so.id, name: so.name, label: so.label || null, extractFilter: null });
    }

    // 2) For each mapping, derive paths and walk them
    for (const m of mappings) {
        const so = m.sourceObject;
        if (!so?.id || !so?.name) continue;
        const cached = objectsById.get(so.id);
        const rootObject = cached || { id: so.id, name: so.name, label: so.label || null, extractFilter: null };

        // (a) direct sourceField — add its name on the source object
        if (m.sourceField?.name) {
            addField(rootObject.id, m.sourceField.name);
        }

        // (b) transformationRule expressions — only meaningful for expression mappings
        const rule = m.transformationRule;
        if (m.mappingType === 'expression' && rule && typeof rule === 'string' && rule.trim()) {
            let refs;
            try {
                const ast = parseTransformationRule(rule);
                refs = Array.from(extractReferencedFields(ast));
            } catch (err) {
                log.warn('Failed to parse transformationRule; falling back to direct sourceField only', {
                    mappingId: m.id,
                    rule,
                    error: err.message,
                });
                refs = [];
            }

            for (const ref of refs) {
                const segments = ref.split('.').filter(Boolean);
                if (segments.length === 0) continue;
                await walkPath({
                    segments,
                    rootObject,
                    objectsByName,
                    getFields,
                    ensureObject,
                    addField,
                });
            }
        }
        // 'as-is' and 'constant' contribute nothing beyond (a)
    }

    const objects = Array.from(planObjects.values()).filter(o => !!o.name);

    log.info('Extraction plan built', {
        sourceOrgId,
        objectCount: objects.length,
        objects: objects.map(o => ({
            name: o.name,
            fields: Array.from(requiredFields.get(o.id) || []).sort(),
        })),
    });

    return { objects, fieldsByObjectId: requiredFields };
}

/**
 * Walk a dotted reference path (e.g. ['Account', 'Owner', 'Name']) starting at
 * rootObject. The first segment may also be the root object's own name
 * (e.g. ['Asset', 'Name']) — we strip it.
 *
 * For each traversal segment we (a) add the FK column on the current object
 * (e.g. 'AccountId' for relationshipName 'Account') and (b) step to the
 * single referenced target. For polymorphic references with multiple
 * referenceTo targets we stop walking and log a warning.
 *
 * The leaf segment is added as a field on the resolved object.
 */
async function walkPath({ segments, rootObject, objectsByName, getFields, ensureObject, addField }) {
    let current = rootObject;
    let currentFields = await getFields(current.id);

    let i = 0;
    if (segments[0] === current.name && segments.length > 1) {
        i = 1;
    }

    while (i < segments.length) {
        const seg = segments[i];
        const isLeaf = i === segments.length - 1;

        if (isLeaf) {
            // Could be a direct field OR a relationship name (rare with no trailing field).
            // Add it as-is to the current object's required set.
            addField(current.id, seg);
            return;
        }

        // Traversal: find a field on `current` whose relationshipName matches seg
        const relField = currentFields.find(f => f.relationshipName && f.relationshipName === seg);
        if (!relField) {
            log.warn('Could not resolve relationship segment; stopping walk', {
                object: current.name,
                segment: seg,
                fullPath: segments.join('.'),
            });
            return;
        }

        // Add the FK column on the current object (e.g. AccountId)
        addField(current.id, relField.name);

        const targets = extractReferenceTargetNames(relField.referenceTo);
        if (targets.length === 0) {
            log.warn('Relationship has no referenceTo targets; stopping walk', {
                object: current.name,
                segment: seg,
            });
            return;
        }
        if (targets.length > 1) {
            log.warn('Polymorphic reference; stopping walk (mapping-driven extraction does not pick a single target)', {
                object: current.name,
                segment: seg,
                targets,
            });
            return;
        }

        const next = objectsByName.get(targets[0]);
        if (!next) {
            log.warn('Referenced object not found in source org metadata; stopping walk', {
                object: current.name,
                segment: seg,
                target: targets[0],
            });
            return;
        }

        ensureObject(next);
        current = next;
        currentFields = await getFields(current.id);
        i += 1;
    }
}

export default { buildExtractionPlan };
export { buildExtractionPlan };
