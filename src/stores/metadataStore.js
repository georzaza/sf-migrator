/**
 * Metadata Store - Pinia store for Salesforce object and field metadata
 * 
 * This store manages object and field metadata separately from mappings.
 * To avoid excessive memory usage, we cache only essential list data
 * and fetch full details on demand.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import axiosInstance from '@/api/axiosInstance';

export const useMetadataStore = defineStore('metadata', () => {
    // ==================== State ====================
    
    // Cache objects by orgId - stores minimal list data
    const objectsByOrg = ref(new Map());
    
    // Cache fields by objectId - stores minimal list data
    const fieldsByObject = ref(new Map());
    
    // Currently selected detailed object (full metadata)
    const selectedObjectDetails = ref(null);
    
    // Currently selected detailed field (full metadata)
    const selectedFieldDetails = ref(null);
    
    const loading = ref(false);
    const error = ref(null);

    // ==================== Actions ====================

    /**
     * Load objects for an org (lightweight list)
     */
    async function loadObjects(orgId) {
        loading.value = true;
        error.value = null;
        try {
            const response = await axiosInstance.get('/api', {
                headers: {
                    action: 'get-objects',
                    orgId: orgId
                }
            });
            const objects = response.data.data || [];
            objectsByOrg.value.set(orgId, objects);
            return objects;
        } catch (err) {
            error.value = err.message || 'Failed to load objects';
            console.error('Error loading objects:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Load fields for an object (lightweight list)
     */
    async function loadFields(objectId) {
        loading.value = true;
        error.value = null;
        try {
            const response = await axiosInstance.get('/api', {
                headers: {
                    action: 'get-fields',
                    objectId: objectId
                }
            });
            const fields = response.data.data || [];
            fieldsByObject.value.set(objectId, fields);
            return fields;
        } catch (err) {
            error.value = err.message || 'Failed to load fields';
            console.error('Error loading fields:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Get objects from cache or fetch if not cached
     */
    function getObjects(orgId) {
        if (objectsByOrg.value.has(orgId)) {
            return objectsByOrg.value.get(orgId);
        }
        return [];
    }

    /**
     * Get fields from cache or fetch if not cached
     */
    function getFields(objectId) {
        if (fieldsByObject.value.has(objectId)) {
            return fieldsByObject.value.get(objectId);
        }
        return [];
    }

    /**
     * Set selected object details (full metadata)
     */
    function setObjectDetails(object) {
        selectedObjectDetails.value = object;
    }

    /**
     * Set selected field details (full metadata)
     */
    function setFieldDetails(field) {
        selectedFieldDetails.value = field;
    }

    /**
     * Clear all cached data
     */
    function clearCache() {
        objectsByOrg.value.clear();
        fieldsByObject.value.clear();
        selectedObjectDetails.value = null;
        selectedFieldDetails.value = null;
    }

    /**
     * Clear cache for a specific org
     */
    function clearOrgCache(orgId) {
        objectsByOrg.value.delete(orgId);
        // Also clear fields for objects belonging to this org
        // (we'd need to track which objects belong to which org for this)
    }

    // ==================== Return ====================
    return {
        // State
        objectsByOrg,
        fieldsByObject,
        selectedObjectDetails,
        selectedFieldDetails,
        loading,
        error,

        // Actions
        loadObjects,
        loadFields,
        getObjects,
        getFields,
        setObjectDetails,
        setFieldDetails,
        clearCache,
        clearOrgCache
    };
});
