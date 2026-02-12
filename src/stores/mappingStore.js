import { defineStore } from 'pinia';
import axiosInstance from '@/api/axiosInstance';

/**
 * Mapping Store
 *
 * Manages object and field mappings between source and target orgs
 * Handles CRUD operations for mappings
 */
export const useMappingStore = defineStore('mapping', {

    persist: true,

    state: () => ({
        // Mapping collections
        objectMappings: [],
        fieldMappings: [],

        // Current working mapping
        currentObjectMapping: null,

        // Loading states
        loadingMappings: false,
        savingMapping: false,

        // Error state
        error: null,
    }),

    getters: {
        /**
         * Get field mappings for current object mapping
         */
        currentFieldMappings: (state) => {
            if (!state.currentObjectMapping) return [];
            return state.fieldMappings.filter(
                fm => fm.objectMappingId === state.currentObjectMapping.id
            );
        },

        /**
         * Get field mappings by object mapping ID
         */
        getFieldMappingsByObjectMapping: (state) => {
            return (objectMappingId) => {
                return state.fieldMappings.filter(
                    fm => fm.objectMappingId === objectMappingId
                );
            };
        },

        /**
         * Get object mapping by source and target object IDs
         */
        getObjectMapping: (state) => {
            return (sourceObjectId, targetObjectId) => {
                return state.objectMappings.find(
                    om => om.sourceObjectId === sourceObjectId &&
                          om.targetObjectId === targetObjectId
                );
            };
        },

        /**
         * Check if a field mapping exists
         */
        hasFieldMapping: (state) => {
            return (objectMappingId, sourceFieldId) => {
                return state.fieldMappings.some(
                    fm => fm.objectMappingId === objectMappingId &&
                          fm.sourceFieldId === sourceFieldId
                );
            };
        },

        /**
         * Get active object mappings
         */
        activeObjectMappings: (state) => {
            return state.objectMappings.filter(om => om.isActive);
        },

        /**
         * Count field mappings by type
         */
        mappingStatistics: (state) => {
            const stats = {
                total: state.fieldMappings.length,
                direct: 0,
                expression: 0,
                constant: 0,
                lookup: 0,
            };

            state.fieldMappings.forEach(fm => {
                if (fm.mappingType) {
                    stats[fm.mappingType] = (stats[fm.mappingType] || 0) + 1;
                }
            });

            return stats;
        },
    },

    actions: {
        /**
         * Load all mappings for a project
         */
        async loadMappings(projectId) {
            if (!projectId) {
                throw new Error('Project ID is required');
            }

            this.loadingMappings = true;
            this.error = null;

            try {
                // Load object mappings
                const objResponse = await axiosInstance.post('/api',
                    { projectId },
                    { headers: { action: 'get-object-mappings' } }
                );

                if (objResponse.data.success) {
                    this.objectMappings = objResponse.data.data;
                } else {
                    throw new Error(objResponse.data.message);
                }

                // Load field mappings
                const fieldResponse = await axiosInstance.post('/api',
                    { projectId },
                    { headers: { action: 'get-field-mappings' } }
                );

                if (fieldResponse.data.success) {
                    this.fieldMappings = fieldResponse.data.data;
                } else {
                    throw new Error(fieldResponse.data.message);
                }

                return {
                    objectMappings: this.objectMappings,
                    fieldMappings: this.fieldMappings
                };
            } catch (error) {
                this.error = error.message;
                console.error('Error loading mappings:', error);
                throw error;
            } finally {
                this.loadingMappings = false;
            }
        },

        /**
         * Create object mapping between source and target objects
         */
        async createObjectMapping(data) {
            const { projectId, sourceObjectId, targetObjectId } = data;

            if (!projectId || !sourceObjectId || !targetObjectId) {
                throw new Error('Missing required fields for object mapping');
            }

            this.savingMapping = true;
            this.error = null;

            try {
                const response = await axiosInstance.put('/api',
                    {
                        projectId,
                        sourceObjectId,
                        targetObjectId,
                        isActive: true
                    },
                    { headers: { action: 'create-object-mapping' } }
                );

                if (response.data.success) {
                    const newMapping = response.data.data;
                    this.objectMappings.push(newMapping);
                    this.currentObjectMapping = newMapping;
                    return newMapping;
                } else {
                    throw new Error(response.data.message);
                }
            } catch (error) {
                this.error = error.message;
                console.error('Error creating object mapping:', error);
                throw error;
            } finally {
                this.savingMapping = false;
            }
        },

        /**
         * Update object mapping
         */
        async updateObjectMapping(id, data) {
            this.savingMapping = true;
            this.error = null;

            try {
                const response = await axiosInstance.post('/api',
                    { id, ...data },
                    { headers: { action: 'update-object-mapping' } }
                );

                if (response.data.success) {
                    const index = this.objectMappings.findIndex(om => om.id === id);
                    if (index !== -1) {
                        this.objectMappings[index] = { ...this.objectMappings[index], ...data };
                    }
                    return response.data.data;
                } else {
                    throw new Error(response.data.message);
                }
            } catch (error) {
                this.error = error.message;
                console.error('Error updating object mapping:', error);
                throw error;
            } finally {
                this.savingMapping = false;
            }
        },

        /**
         * Delete object mapping
         */
        async deleteObjectMapping(id) {
            this.savingMapping = true;
            this.error = null;

            try {
                const response = await axiosInstance.request({
                    method: 'DELETE',
                    url: '/api',
                    headers: { action: 'delete-object-mapping' },
                    data: { id }
                });

                if (response.data.success) {
                    this.objectMappings = this.objectMappings.filter(om => om.id !== id);
                    // Also remove related field mappings
                    this.fieldMappings = this.fieldMappings.filter(
                        fm => fm.objectMappingId !== id
                    );
                    if (this.currentObjectMapping?.id === id) {
                        this.currentObjectMapping = null;
                    }
                    return true;
                } else {
                    throw new Error(response.data.message);
                }
            } catch (error) {
                this.error = error.message;
                console.error('Error deleting object mapping:', error);
                throw error;
            } finally {
                this.savingMapping = false;
            }
        },

        /**
         * Create field mapping
         *
         * @param {Object} data - Field mapping data
         * @param {string} data.objectMappingId - Object mapping ID
         * @param {string} data.sourceFieldId - Source field ID
         * @param {string} data.targetFieldId - Target field ID (optional for expression)
         * @param {string} data.mappingType - Type: 'direct', 'expression', 'constant', 'lookup'
         * @param {string} data.transformExpression - Expression for transformation (optional)
         * @param {string} data.constantValue - Constant value (optional)
         */
        async createFieldMapping(data) {
            const { objectMappingId, sourceFieldId, mappingType } = data;

            // sourceFieldId is optional for 'constant' mapping type
            if (!objectMappingId || !mappingType) {
                throw new Error('Missing required fields for field mapping');
            }

            if (mappingType !== 'constant' && !sourceFieldId) {
                throw new Error('sourceFieldId is required for non-constant mappings');
            }

            this.savingMapping = true;
            this.error = null;

            try {
                const response = await axiosInstance.put('/api',
                    data,
                    { headers: { action: 'create-field-mapping' } }
                );

                if (response.data.success) {
                    const newMapping = response.data.data;
                    this.fieldMappings.push(newMapping);
                    return newMapping;
                } else {
                    throw new Error(response.data.message);
                }
            } catch (error) {
                this.error = error.message;
                console.error('Error creating field mapping:', error);
                throw error;
            } finally {
                this.savingMapping = false;
            }
        },

        /**
         * Update field mapping
         */
        async updateFieldMapping(id, data) {
            this.savingMapping = true;
            this.error = null;

            try {
                const response = await axiosInstance.post('/api',
                    { id, ...data },
                    { headers: { action: 'update-field-mapping' } }
                );

                if (response.data.success) {
                    const index = this.fieldMappings.findIndex(fm => fm.id === id);
                    if (index !== -1) {
                        this.fieldMappings[index] = { ...this.fieldMappings[index], ...data };
                    }
                    return response.data.data;
                } else {
                    throw new Error(response.data.message);
                }
            } catch (error) {
                this.error = error.message;
                console.error('Error updating field mapping:', error);
                throw error;
            } finally {
                this.savingMapping = false;
            }
        },

        /**
         * Delete field mapping
         */
        async deleteFieldMapping(id) {
            this.savingMapping = true;
            this.error = null;

            try {
                const response = await axiosInstance.request({
                    method: 'DELETE',
                    url: '/api',
                    headers: { action: 'delete-field-mapping' },
                    data: { id }
                });

                if (response.data.success) {
                    this.fieldMappings = this.fieldMappings.filter(fm => fm.id !== id);
                    return true;
                } else {
                    throw new Error(response.data.message);
                }
            } catch (error) {
                this.error = error.message;
                console.error('Error deleting field mapping:', error);
                throw error;
            } finally {
                this.savingMapping = false;
            }
        },

        /**
         * Set current object mapping for editing
         */
        setCurrentObjectMapping(mapping) {
            this.currentObjectMapping = mapping;
        },

        /**
         * Create direct field mapping (drag-drop)
         */
        async createDirectMapping(objectMappingId, sourceField, targetField) {
            return await this.createFieldMapping({
                objectMappingId,
                sourceFieldId: sourceField.id,
                targetFieldId: targetField.id,
                mappingType: 'direct'
            });
        },

        /**
         * Create expression-based mapping
         */
        async createExpressionMapping(objectMappingId, sourceField, targetField, expression) {
            return await this.createFieldMapping({
                objectMappingId,
                sourceFieldId: sourceField.id,
                targetFieldId: targetField.id,
                mappingType: 'expression',
                transformExpression: expression
            });
        },

        /**
         * Create constant value mapping
         */
        async createConstantMapping(objectMappingId, targetField, constantValue) {
            return await this.createFieldMapping({
                objectMappingId,
                sourceFieldId: null,
                targetFieldId: targetField.id,
                mappingType: 'constant',
                constantValue
            });
        },

        /**
         * Bulk create field mappings (for auto-mapping)
         */
        async bulkCreateFieldMappings(mappings) {
            this.savingMapping = true;
            this.error = null;

            const results = [];
            const errors = [];

            for (const mapping of mappings) {
                try {
                    const result = await this.createFieldMapping(mapping);
                    results.push(result);
                } catch (error) {
                    errors.push({ mapping, error: error.message });
                }
            }

            this.savingMapping = false;

            return {
                success: results.length,
                failed: errors.length,
                results,
                errors
            };
        },

        /**
         * Auto-map fields by matching names
         */
        async autoMapFields(objectMappingId, sourceFields, targetFields, options = {}) {
            const { caseSensitive = false, exactMatch = true } = options;
            const mappings = [];

            for (const sourceField of sourceFields) {
                const sourceName = caseSensitive ?
                    sourceField.fieldName :
                    sourceField.fieldName.toLowerCase();

                const targetField = targetFields.find(tf => {
                    const targetName = caseSensitive ?
                        tf.fieldName :
                        tf.fieldName.toLowerCase();

                    return exactMatch ?
                        sourceName === targetName :
                        targetName.includes(sourceName) || sourceName.includes(targetName);
                });

                if (targetField) {
                    mappings.push({
                        objectMappingId,
                        sourceFieldId: sourceField.id,
                        targetFieldId: targetField.id,
                        mappingType: 'direct'
                    });
                }
            }

            if (mappings.length > 0) {
                return await this.bulkCreateFieldMappings(mappings);
            }

            return { success: 0, failed: 0, results: [], errors: [] };
        },

        /**
         * Reset all mappings
         */
        reset() {
            this.$reset();
        },

        /**
         * Clear current object mapping
         */
        clearCurrentMapping() {
            this.currentObjectMapping = null;
        },
    },
});
