import { defineStore } from 'pinia';
import axiosInstance from '@/api/axiosInstance';

/**
 * Metadata Store
 *
 * Manages Salesforce metadata state for migration workspace
 * Handles source/target orgs, objects, and fields
 */
export const useMetadataStore = defineStore('metadata', {

    persist: true,

    state: () => ({
        // Organization selection
        sourceOrg: null,
        targetOrg: null,

        // Metadata collections
        sourceObjects: [],
        targetObjects: [],
        sourceFields: {},  // Keyed by objectId for quick lookup
        targetFields: {},  // Keyed by objectId for quick lookup

        // Current selections
        selectedSourceObject: null,
        selectedTargetObject: null,

        // Metadata statistics
        sourceStats: null,
        targetStats: null,

        // Loading states
        loadingSourceMetadata: false,
        loadingTargetMetadata: false,
        loadingSourceFields: false,
        loadingTargetFields: false,

        // Error states
        sourceError: null,
        targetError: null,
    }),

    getters: {
        /**
         * Get fields for currently selected source object
         */
        currentSourceFields: (state) => {
            if (!state.selectedSourceObject) return [];
            return state.sourceFields[state.selectedSourceObject.id] || [];
        },

        /**
         * Get fields for currently selected target object
         */
        currentTargetFields: (state) => {
            if (!state.selectedTargetObject) return [];
            return state.targetFields[state.selectedTargetObject.id] || [];
        },

        /**
         * Check if source org has been analyzed
         */
        sourceAnalyzed: (state) => {
            return state.sourceObjects.length > 0;
        },

        /**
         * Check if target org has been analyzed
         */
        targetAnalyzed: (state) => {
            return state.targetObjects.length > 0;
        },

        /**
         * Check if both orgs are ready for mapping
         */
        readyForMapping: (state) => {
            return Boolean(state.sourceOrg &&
                   state.targetOrg &&
                   state.sourceObjects.length > 0 &&
                   state.targetObjects.length > 0);
        },

        /**
         * Get source objects filtered by type
         */
        sourceCustomObjects: (state) => {
            return state.sourceObjects.filter(obj => obj.custom);
        },

        sourceStandardObjects: (state) => {
            return state.sourceObjects.filter(obj => !obj.custom);
        },

        /**
         * Get target objects filtered by type
         */
        targetCustomObjects: (state) => {
            return state.targetObjects.filter(obj => obj.custom);
        },

        targetStandardObjects: (state) => {
            return state.targetObjects.filter(obj => !obj.custom);
        },
    },

    actions: {
        /**
         * Set source organization
         * @param {Object} org - Can be either the org object directly or PrimeVue option format {label, value}
         */
        setSourceOrg(org) {
            // Extract the actual org object if it's wrapped in PrimeVue option format
            const actualOrg = org?.value ? org.value : org;
            this.sourceOrg = actualOrg;
            // Clear previous metadata when org changes
            this.sourceObjects = [];
            this.sourceFields = {};
            this.selectedSourceObject = null;
            this.sourceStats = null;
            this.sourceError = null;
        },

        /**
         * Set target organization
         * @param {Object} org - Can be either the org object directly or PrimeVue option format {label, value}
         */
        setTargetOrg(org) {
            // Extract the actual org object if it's wrapped in PrimeVue option format
            const actualOrg = org?.value ? org.value : org;
            this.targetOrg = actualOrg;
            // Clear previous metadata when org changes
            this.targetObjects = [];
            this.targetFields = {};
            this.selectedTargetObject = null;
            this.targetStats = null;
            this.targetError = null;
        },

        /**
         * Select source object and load its fields
         */
        async selectSourceObject(object) {
            this.selectedSourceObject = object;

            // Load fields if not already loaded
            if (object && !this.sourceFields[object.id]) {
                await this.loadSourceFields(object.id);
            }
        },

        /**
         * Select target object and load its fields
         */
        async selectTargetObject(object) {
            this.selectedTargetObject = object;

            // Load fields if not already loaded
            if (object && !this.targetFields[object.id]) {
                await this.loadTargetFields(object.id);
            }
        },

        /**
         * Analyze source org - triggers metadata retrieval from Salesforce
         */
        async analyzeSourceOrg(options = {}) {
            if (!this.sourceOrg) {
                throw new Error('No source org selected');
            }

            this.loadingSourceMetadata = true;
            this.sourceError = null;

            try {
                const response = await axiosInstance.post('/api',
                    {
                        orgId: this.sourceOrg.id,
                        includeCustomOnly: typeof options.includeCustomOnly === 'boolean' && options.includeCustomOnly,
                        excludeManaged: typeof options.excludeManaged === 'boolean' && options.excludeManaged,
                    },
                    {
                        headers: { action: 'analyze-org' }
                    }
                );

                if (response.data.success) {
                    // After analysis, load the objects
                    await this.loadSourceObjects();
                    return response.data.data;
                } else {
                    this.sourceError = response.data.message;
                    throw new Error(response.data.message);
                }
            } catch (error) {
                this.sourceError = error.message;
                throw error;
            } finally {
                this.loadingSourceMetadata = false;
            }
        },

        /**
         * Analyze target org - triggers metadata retrieval from Salesforce
         */
        async analyzeTargetOrg(options = {}) {
            if (!this.targetOrg) {
                throw new Error('No target org selected');
            }

            this.loadingTargetMetadata = true;
            this.targetError = null;

            try {
                const response = await axiosInstance.post('/api',
                    {
                        orgId: this.targetOrg.id,
                        includeCustomOnly: typeof options.includeCustomOnly === 'boolean' && options.includeCustomOnly,
                        excludeManaged: typeof options.excludeManaged === 'boolean' && options.excludeManaged,
                    },
                    {
                        headers: { action: 'analyze-org' }
                    }
                );

                if (response.data.success) {
                    // After analysis, load the objects
                    await this.loadTargetObjects();
                    return response.data.data;
                } else {
                    this.targetError = response.data.message;
                    throw new Error(response.data.message);
                }
            } catch (error) {
                this.targetError = error.message;
                throw error;
            } finally {
                this.loadingTargetMetadata = false;
            }
        },

        /**
         * Load objects for source org from database
         */
        async loadSourceObjects(includeFields = false) {
            if (!this.sourceOrg) {
                throw new Error('No source org selected');
            }

            if (!this.sourceOrg.id) {
                console.error('Source org missing id property:', this.sourceOrg);
                throw new Error('Source org is missing id property');
            }

            this.loadingSourceMetadata = true;
            this.sourceError = null;

            try {
                const response = await axiosInstance.get('/api', {
                    headers: {
                        action: 'get-objects',
                        orgid: this.sourceOrg.id
                    },
                    params: { includeFields }
                });

                if (response.data.success) {
                    this.sourceObjects = response.data.data;
                    return this.sourceObjects;
                } else {
                    this.sourceError = response.data.message;
                    throw new Error(response.data.message);
                }
            } catch (error) {
                this.sourceError = error.message;
                throw error;
            } finally {
                this.loadingSourceMetadata = false;
            }
        },

        /**
         * Load objects for target org from database
         */
        async loadTargetObjects(includeFields = false) {
            if (!this.targetOrg) {
                throw new Error('No target org selected');
            }

            this.loadingTargetMetadata = true;
            this.targetError = null;

            try {
                const response = await axiosInstance.get('/api', {
                    headers: {
                        action: 'get-objects',
                        orgid: this.targetOrg.id
                    },
                    params: { includeFields }
                });

                if (response.data.success) {
                    this.targetObjects = response.data.data;
                    return this.targetObjects;
                } else {
                    this.targetError = response.data.message;
                    throw new Error(response.data.message);
                }
            } catch (error) {
                this.targetError = error.message;
                throw error;
            } finally {
                this.loadingTargetMetadata = false;
            }
        },

        /**
         * Load fields for a source object
         */
        async loadSourceFields(objectId) {
            this.loadingSourceFields = true;

            try {
                const response = await axiosInstance.get('/api', {
                    headers: {
                        action: 'get-fields',
                        objectid: objectId
                    }
                });

                if (response.data.success) {
                    this.sourceFields[objectId] = response.data.data;
                    return response.data.data;
                } else {
                    throw new Error(response.data.message);
                }
            } catch (error) {
                console.error('Error loading source fields:', error);
                throw error;
            } finally {
                this.loadingSourceFields = false;
            }
        },

        /**
         * Load fields for a target object
         */
        async loadTargetFields(objectId) {
            this.loadingTargetFields = true;

            try {
                const response = await axiosInstance.get('/api', {
                    headers: {
                        action: 'get-fields',
                        objectid: objectId
                    }
                });

                if (response.data.success) {
                    this.targetFields[objectId] = response.data.data;
                    return response.data.data;
                } else {
                    throw new Error(response.data.message);
                }
            } catch (error) {
                console.error('Error loading target fields:', error);
                throw error;
            } finally {
                this.loadingTargetFields = false;
            }
        },

        /**
         * Get metadata statistics for source org
         */
        async loadSourceStats() {
            if (!this.sourceOrg) {
                throw new Error('No source org selected');
            }

            try {
                const response = await axiosInstance.get('/api', {
                    headers: {
                        action: 'get-org-stats',
                        orgid: this.sourceOrg.id
                    }
                });

                if (response.data.success) {
                    this.sourceStats = response.data.data;
                    return this.sourceStats;
                } else {
                    throw new Error(response.data.message);
                }
            } catch (error) {
                console.error('Error loading source stats:', error);
                throw error;
            }
        },

        /**
         * Get metadata statistics for target org
         */
        async loadTargetStats() {
            if (!this.targetOrg) {
                throw new Error('No target org selected');
            }

            try {
                const response = await axiosInstance.get('/api', {
                    headers: {
                        action: 'get-org-stats',
                        orgid: this.targetOrg.id
                    }
                });

                if (response.data.success) {
                    this.targetStats = response.data.data;
                    return this.targetStats;
                } else {
                    throw new Error(response.data.message);
                }
            } catch (error) {
                console.error('Error loading target stats:', error);
                throw error;
            }
        },

        /**
         * Test connection to source org
         */
        async testSourceConnection() {
            if (!this.sourceOrg) {
                throw new Error('No source org selected');
            }

            try {
                const response = await axiosInstance.post('/api',
                    { orgId: this.sourceOrg.id },
                    { headers: { action: 'test-sf-connection' } }
                );

                if (response.data.success) {
                    return response.data.data;
                } else {
                    throw new Error(response.data.message);
                }
            } catch (error) {
                console.error('Error testing source connection:', error);
                throw error;
            }
        },

        /**
         * Test connection to target org
         */
        async testTargetConnection() {
            if (!this.targetOrg) {
                throw new Error('No target org selected');
            }

            try {
                const response = await axiosInstance.post('/api',
                    { orgId: this.targetOrg.id },
                    { headers: { action: 'test-sf-connection' } }
                );

                if (response.data.success) {
                    return response.data.data;
                } else {
                    throw new Error(response.data.message);
                }
            } catch (error) {
                console.error('Error testing target connection:', error);
                throw error;
            }
        },

        /**
         * Reset all metadata
         */
        reset() {
            this.$reset();
        },

        /**
         * Reset source metadata only
         */
        resetSource() {
            this.sourceOrg = null;
            this.sourceObjects = [];
            this.sourceFields = {};
            this.selectedSourceObject = null;
            this.sourceStats = null;
            this.sourceError = null;
        },

        /**
         * Reset target metadata only
         */
        resetTarget() {
            this.targetOrg = null;
            this.targetObjects = [];
            this.targetFields = {};
            this.selectedTargetObject = null;
            this.targetStats = null;
            this.targetError = null;
        },
    },
});
