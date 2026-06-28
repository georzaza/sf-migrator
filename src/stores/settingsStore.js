/**
 * Settings Store - Pinia store for per-object-pair migration settings
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import axiosInstance from '@/api/axiosInstance';

export const useSettingsStore = defineStore('settings', () => {
    // ==================== State ====================
    const loading = ref(false);
    const error = ref(null);

    // ==================== Actions ====================

    /**
     * Load the migration setting for a source/target object pair.
     * Returns the setting object, or null when none has been saved yet.
     */
    async function loadSetting(sourceObjectId, targetObjectId) {
        loading.value = true;
        error.value = null;
        try {
            const response = await axiosInstance.get('/api', {
                headers: {
                    action: 'get-migration-setting',
                    sourceObjectId,
                    targetObjectId,
                },
            });
            return response.data.data || null;
        } catch (err) {
            error.value = err.message || 'Failed to load migration setting';
            console.error('Error loading migration setting:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Create or update the migration setting for a source/target object pair.
     */
    async function saveSetting(sourceObjectId, targetObjectId, updates) {
        loading.value = true;
        error.value = null;
        try {
            const response = await axiosInstance.put('/api', {
                sourceObjectId,
                targetObjectId,
                ...updates,
            }, {
                headers: { action: 'upsert-migration-setting' },
            });
            return response.data.data;
        } catch (err) {
            error.value = err.message || 'Failed to save migration setting';
            console.error('Error saving migration setting:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    return {
        // State
        loading,
        error,

        // Actions
        loadSetting,
        saveSetting,
    };
});
