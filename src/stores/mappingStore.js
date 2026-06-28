/**
 * Mapping Store - Pinia store for object and field mappings
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axiosInstance from '@/api/axiosInstance';

export const useMappingStore = defineStore('mapping', () => {
    // ==================== State ====================
    const objectMappings = ref([]);
    const currentMapping = ref(null);
    const fieldMappings = ref([]);
    const loading = ref(false);
    const error = ref(null);

    // ==================== Getters ====================
    const getMappingById = computed(() => {
        return (id) => objectMappings.value.find(m => m.id === id);
    });

    const fieldMappingsByObjectMapping = computed(() => {
        return (mappingId) => fieldMappings.value.filter(m => `${m.sourceObjectId}:${m.targetObjectId}` === mappingId);
    });

    // ==================== Actions ====================

    /**
     * Load object mappings for an org pair
     */
    async function loadMappings(sourceOrgId, targetOrgId = null) {
        loading.value = true;
        error.value = null;
        try {
            const headers = {
                action: 'get-mappings',
                sourceOrgId: sourceOrgId
            };
            if (targetOrgId) {
                headers.targetOrgId = targetOrgId;
            }

            const response = await axiosInstance.get('/api', { headers });
            objectMappings.value = response.data.data || [];
            return objectMappings.value;
        } catch (err) {
            error.value = err.message || 'Failed to load mappings';
            console.error('Error loading mappings:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Load field mappings for an object mapping
     */
    async function loadFieldMappings(mappingId) {
        loading.value = true;
        error.value = null;
        try {
            const response = await axiosInstance.get('/api', {
                headers: {
                    action: 'get-field-mappings',
                    mappingId
                }
            });
            fieldMappings.value = response.data.data || [];
            return fieldMappings.value;
        } catch (err) {
            error.value = err.message || 'Failed to load field mappings';
            console.error('Error loading field mappings:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Create an object mapping
     */
    async function createMapping(sourceObjectId, targetObjectId) {
        loading.value = true;
        error.value = null;
        try {
            const response = await axiosInstance.post('/api', {
                sourceObjectId,
                targetObjectId
            }, {
                headers: { action: 'create-mapping' }
            });
            const newMapping = response.data.data;
            objectMappings.value.push(newMapping);
            return newMapping;
        } catch (err) {
            error.value = err.message || 'Failed to create mapping';
            console.error('Error creating mapping:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Create a field mapping
     */
    async function createFieldMapping(data) {
        loading.value = true;
        error.value = null;
        try {
            const response = await axiosInstance.post('/api', data, {
                headers: { action: 'create-field-mapping' }
            });
            const newMapping = response.data.data;
            fieldMappings.value.push(newMapping);
            return newMapping;
        } catch (err) {
            error.value = err.message || 'Failed to create field mapping';
            console.error('Error creating field mapping:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Update an object mapping
     */
    async function updateMapping(mappingId, updates) {
        loading.value = true;
        error.value = null;
        try {
            const response = await axiosInstance.put('/api', updates, {
                headers: {
                    action: 'update-mapping',
                    mappingId: mappingId
                }
            });
            const updatedMapping = response.data.data;

            // Update in local array
            const index = objectMappings.value.findIndex(m => m.id === mappingId);
            if (index !== -1) {
                objectMappings.value[index] = updatedMapping;
            }

            if (currentMapping.value?.id === mappingId) {
                currentMapping.value = updatedMapping;
            }

            return updatedMapping;
        } catch (err) {
            error.value = err.message || 'Failed to update mapping';
            console.error('Error updating mapping:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Update a field mapping
     */
    async function updateFieldMapping(mappingId, updates) {
        loading.value = true;
        error.value = null;
        try {
            const response = await axiosInstance.put('/api', updates, {
                headers: {
                    action: 'update-field-mapping',
                    mappingId: mappingId
                }
            });
            const updatedMapping = response.data.data;

            // Update in local array
            const index = fieldMappings.value.findIndex(m => m.id === mappingId);
            if (index !== -1) {
                fieldMappings.value[index] = updatedMapping;
            }

            return updatedMapping;
        } catch (err) {
            error.value = err.message || 'Failed to update field mapping';
            console.error('Error updating field mapping:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Delete an object mapping
     */
    async function deleteMapping(mappingId) {
        loading.value = true;
        error.value = null;
        try {
            await axiosInstance.delete('/api', {
                headers: {
                    action: 'delete-mapping',
                    mappingId: mappingId
                }
            });

            // Remove from local array
            objectMappings.value = objectMappings.value.filter(m => m.id !== mappingId);

            if (currentMapping.value?.id === mappingId) {
                currentMapping.value = null;
            }
        } catch (err) {
            error.value = err.message || 'Failed to delete mapping';
            console.error('Error deleting mapping:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Delete a field mapping
     */
    async function deleteFieldMapping(mappingId) {
        loading.value = true;
        error.value = null;
        try {
            await axiosInstance.delete('/api', {
                headers: {
                    action: 'delete-field-mapping',
                    mappingId: mappingId
                }
            });

            // Remove from local array
            fieldMappings.value = fieldMappings.value.filter(m => m.id !== mappingId);
        } catch (err) {
            error.value = err.message || 'Failed to delete field mapping';
            console.error('Error deleting field mapping:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Set current mapping for detail view
     */
    function setCurrentMapping(mapping) {
        currentMapping.value = mapping;
    }

    /**
     * Validate an object pair and return advisory warnings (e.g. required
     * target fields that are not yet mapped). Returns [] on failure.
     */
    async function validateObjectMapping(sourceObjectId, targetObjectId) {
        try {
            const response = await axiosInstance.get('/api', {
                headers: {
                    action: 'validate-object-mapping',
                    sourceObjectId,
                    targetObjectId,
                },
            });
            return response.data.data?.warnings || [];
        } catch (err) {
            console.error('Error validating object mapping:', err);
            return [];
        }
    }

    /**
     * Clear all state
     */
    function clearMappings() {
        objectMappings.value = [];
        currentMapping.value = null;
        fieldMappings.value = [];
        error.value = null;
    }

    return {
        // State
        objectMappings,
        currentMapping,
        fieldMappings,
        loading,
        error,

        // Getters
        getMappingById,
        fieldMappingsByObjectMapping,

        // Actions
        loadMappings,
        loadFieldMappings,
        createMapping,
        createFieldMapping,
        updateMapping,
        updateFieldMapping,
        deleteMapping,
        deleteFieldMapping,
        setCurrentMapping,
        validateObjectMapping,
        clearMappings,
    };
});
