/**
 * Dependency Service - builds the object load plan for a source/target org pair.
 *
 * Produces a topological load order (parents before children) across all lookup/
 * master-detail references between objects in the migration set, and detects cycles.
 * Cyclic (or self-referential) lookup edges are cut and reported as deferred fields,
 * to be populated in a second pass once target record Ids are known.
 */

import mappingService from './mappingService.js';
import migrationSettingService from './migrationSettingService.js';
import logger from '../lib/logger.js';

const log = logger.create('dependencyService');

/**
 * Extract the referenced object API names from a field's referenceTo metadata.
 */
function extractReferenceTargetNames(referenceTo) {
    if (!Array.isArray(referenceTo) || referenceTo.length === 0) return [];
    const names = [];
    for (const ref of referenceTo) {
        let name = null;
        if (typeof ref === 'string') {
            name = ref;
        } else if (ref && typeof ref === 'object') {
            name = ref.objectApiName || ref.name || ref.sobject || ref.targetObjectName || null;
        }
        if (!name || names.includes(name)) continue;
        names.push(name);
    }
    return names;
}

function isReferenceField(field) {
    return field.type === 'reference' ||
        field.type === 'lookup' ||
        field.type === 'masterdetail' ||
        (Array.isArray(field.referenceTo) && field.referenceTo.length > 0);
}

function isMappedReferenceField(mapping) {
    return mapping.mappingType === 'as-is' &&
        mapping.sourceField &&
        isReferenceField(mapping.sourceField);
}

/**
 * Build the load plan for an org pair.
 * @returns {Promise<{loadOrder: Array, deferredFields: Array}>}
 */
async function getLoadPlan(sourceOrgId, targetOrgId) {
    log.info('Building load plan', { sourceOrgId, targetOrgId });

    const fieldMappingsRaw = await mappingService.getFieldMappingsByOrgPair(sourceOrgId, targetOrgId);
    const settingsMap = await migrationSettingService.getEffectiveSettingsMap(sourceOrgId, targetOrgId);

    // Drop mappings whose (source, target) pair is explicitly disabled in MigrationSettings.
    const fieldMappings = fieldMappingsRaw.filter((m) => {
        const targets = settingsMap.get(m.sourceObjectId);
        const setting = targets?.get(m.targetObjectId);
        return setting ? setting.enabled : true;
    });
    if (fieldMappings.length !== fieldMappingsRaw.length) {
        log.info('Filtered disabled object pairs from load plan', {
            removed: fieldMappingsRaw.length - fieldMappings.length,
            kept: fieldMappings.length,
        });
    }

    // Nodes = mapped source objects (deduped). nameToId maps source object API name -> id.
    const nodes = new Map();
    const nameToId = new Map();
    for (const mapping of fieldMappings) {
        if (!mapping.sourceObjectId || !mapping.sourceObject?.name) continue;
        if (nodes.has(mapping.sourceObjectId)) continue;
        const node = {
            sourceObjectId: mapping.sourceObjectId,
            sourceObjectName: mapping.sourceObject.name,
            targetObjectId: mapping.targetObjectId,
            targetObjectName: mapping.targetObject?.name || null,
        };
        nodes.set(node.sourceObjectId, node);
        nameToId.set(node.sourceObjectName, node.sourceObjectId);
    }

    // deps: childId -> Set(parentId). children: parentId -> Set(childId).
    const deps = new Map();
    const children = new Map();
    const edgeField = new Map(); // `${childId}->${parentId}` -> { fieldName, referencedObjectName }
    const deferredFields = [];

    for (const node of nodes.values()) {
        deps.set(node.sourceObjectId, new Set());
        children.set(node.sourceObjectId, new Set());
    }

    for (const node of nodes.values()) {
        const mappedReferenceFields = fieldMappings.filter((mapping) =>
            mapping.sourceObjectId === node.sourceObjectId &&
            isMappedReferenceField(mapping)
        );

        for (const mapping of mappedReferenceFields) {
            const field = mapping.sourceField;
            const refNames = extractReferenceTargetNames(field.referenceTo);
            for (const refName of refNames) {
                const parentId = nameToId.get(refName);
                if (!parentId) continue; // referenced object not part of this migration set

                if (parentId === node.sourceObjectId) {
                    // Self-reference (e.g. Account.ParentId) - always a cycle, defer immediately.
                    deferredFields.push({
                        sourceObjectId: node.sourceObjectId,
                        sourceObjectName: node.sourceObjectName,
                        fieldName: field.name,
                        referencedObjectName: refName,
                        reason: 'self-reference',
                    });
                    continue;
                }

                deps.get(node.sourceObjectId).add(parentId);
                children.get(parentId).add(node.sourceObjectId);
                edgeField.set(`${node.sourceObjectId}->${parentId}`, {
                    fieldName: field.name,
                    referencedObjectName: refName,
                });
            }
        }
    }

    // Kahn's algorithm with cycle-cutting.
    const inDegree = new Map();
    for (const [id, parents] of deps) inDegree.set(id, parents.size);

    const queue = [];
    for (const [id, degree] of inDegree) {
        if (degree === 0) queue.push(id);
    }

    const orderedIds = [];
    const remaining = new Set(nodes.keys());

    while (remaining.size > 0) {
        if (queue.length === 0) {
            // A cycle remains - cut one incoming edge of an arbitrary remaining node.
            const childId = [...remaining].find(id => deps.get(id).size > 0);
            const parentId = [...deps.get(childId)][0];
            const cut = edgeField.get(`${childId}->${parentId}`);
            const childNode = nodes.get(childId);
            deferredFields.push({
                sourceObjectId: childId,
                sourceObjectName: childNode.sourceObjectName,
                fieldName: cut?.fieldName || null,
                referencedObjectName: cut?.referencedObjectName || nodes.get(parentId)?.sourceObjectName || null,
                reason: 'cycle',
            });
            log.warn('Cut cyclic lookup edge', {
                object: childNode.sourceObjectName,
                field: cut?.fieldName,
                referencedObject: cut?.referencedObjectName,
            });
            deps.get(childId).delete(parentId);
            children.get(parentId).delete(childId);
            inDegree.set(childId, deps.get(childId).size);
            if (inDegree.get(childId) === 0) queue.push(childId);
            continue;
        }

        const id = queue.shift();
        if (!remaining.has(id)) continue;
        remaining.delete(id);
        orderedIds.push(id);

        for (const childId of children.get(id)) {
            inDegree.set(childId, inDegree.get(childId) - 1);
            if (inDegree.get(childId) === 0) queue.push(childId);
        }
    }

    const loadOrder = orderedIds.map(id => nodes.get(id));

    log.info('Load plan built', {
        sourceOrgId,
        targetOrgId,
        objectCount: loadOrder.length,
        deferredFieldCount: deferredFields.length,
    });

    return { loadOrder, deferredFields };
}

export default {
    getLoadPlan,
};
