/**
 * Pipeline Store — Pinia store for the migration pipeline (load plan, traceback
 * External-Id selection, transform + load triggers/status, and load results).
 *
 * Thin data layer over the action-dispatch API. Polling/orchestration lives in
 * the usePipeline composable; this store holds the shared reactive state and the
 * raw API calls.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import axiosInstance from '@/api/axiosInstance';

const emptyStatus = () => ({ status: 'idle', progress: null, summary: null, error: null });
const emptyExtraction = () => ({
    extractionStatus: 'idle',
    summary: null,
    error: null,
    currentObject: null,
    objectsRemaining: null,
});

export const usePipelineStore = defineStore('pipeline', () => {
    // ==================== State ====================
    const loading = ref(false);
    const error = ref(null);

    const loadPlan = ref({ loadOrder: [], deferredFields: [] });
    const extractionStatus = ref(emptyExtraction());
    const transformStatus = ref(emptyStatus());
    const loadStatus = ref(emptyStatus());

    // ==================== Load plan ====================

    async function fetchLoadPlan(sourceOrgId, targetOrgId) {
        loading.value = true;
        error.value = null;
        try {
            const response = await axiosInstance.get('/api', {
                headers: { action: 'get-load-plan', sourceOrgId, targetOrgId },
            });
            loadPlan.value = response.data.data || { loadOrder: [], deferredFields: [] };
            return loadPlan.value;
        } catch (err) {
            error.value = err.response?.data?.message || err.message || 'Failed to load plan';
            throw err;
        } finally {
            loading.value = false;
        }
    }

    // ==================== Traceback (External Id) ====================

    async function fetchTracebackCandidates(targetObjectId) {
        const response = await axiosInstance.get('/api', {
            headers: { action: 'get-traceback-candidates', targetObjectId },
        });
        return response.data.data || [];
    }

    /**
     * Read the currently-selected traceback field for a pair from the migration
     * setting metadata. Returns { id, name } | null.
     */
    async function fetchSelectedTracebackField(sourceObjectId, targetObjectId) {
        const response = await axiosInstance.get('/api', {
            headers: { action: 'get-migration-setting', sourceObjectId, targetObjectId },
        });
        return response.data.data?.metadata?.tracebackExternalIdField || null;
    }

    async function saveTracebackField(sourceObjectId, targetObjectId, fieldId) {
        const response = await axiosInstance.put('/api', {
            sourceObjectId,
            targetObjectId,
            fieldId: fieldId ?? null,
        }, {
            headers: { action: 'set-traceback-field' },
        });
        return response.data.data || null;
    }

    // ==================== Extraction (source org) ====================

    async function startExtraction(sourceOrgId) {
        extractionStatus.value = { ...emptyExtraction(), extractionStatus: 'running' };
        const response = await axiosInstance.post('/api', { sourceOrgId }, {
            headers: { action: 'start-extraction' },
        });
        return response;
    }

    async function fetchExtractionStatus(sourceOrgId) {
        const response = await axiosInstance.get('/api', {
            headers: { action: 'get-extraction-status', orgid: sourceOrgId },
        });
        extractionStatus.value = response.data.data || emptyExtraction();
        return extractionStatus.value;
    }

    // ==================== Transform ====================

    async function startTransform(sourceOrgId, targetOrgId) {
        transformStatus.value = { status: 'running', progress: null, summary: null, error: null };
        const response = await axiosInstance.post('/api', { sourceOrgId, targetOrgId }, {
            headers: { action: 'start-transform' },
        });
        return response;
    }

    async function fetchTransformStatus(sourceOrgId, targetOrgId) {
        const response = await axiosInstance.get('/api', {
            headers: { action: 'get-transform-status', sourceOrgId, targetOrgId },
        });
        transformStatus.value = response.data.data || emptyStatus();
        return transformStatus.value;
    }

    // ==================== Load ====================

    async function startLoad(sourceOrgId, targetOrgId) {
        loadStatus.value = { status: 'running', progress: null, summary: null, error: null };
        const response = await axiosInstance.post('/api', { sourceOrgId, targetOrgId }, {
            headers: { action: 'start-load' },
        });
        return response;
    }

    async function fetchLoadStatus(sourceOrgId, targetOrgId) {
        const response = await axiosInstance.get('/api', {
            headers: { action: 'get-load-status', sourceOrgId, targetOrgId },
        });
        loadStatus.value = response.data.data || emptyStatus();
        return loadStatus.value;
    }

    // ==================== Load results ====================

    async function fetchLoadRecords(targetOrgId, targetObjectName, status = 'all') {
        const response = await axiosInstance.get('/api', {
            headers: { action: 'get-load-records', targetOrgId, targetObjectName, status },
        });
        return response.data.data || { runId: null, records: [] };
    }

    /**
     * Download a load success/error CSV as a file. type = 'success' | 'error'.
     */
    async function downloadLoadCsv(targetOrgId, runId, objectName, type) {
        const response = await axiosInstance.get('/api', {
            headers: { action: 'download-load-csv', targetOrgId, runId, objectName, type },
            responseType: 'blob',
        });
        if (response.status !== 200) {
            throw new Error('CSV file not found');
        }
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${objectName}_${type === 'success' ? 'success' : 'errors'}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }

    function reset() {
        loadPlan.value = { loadOrder: [], deferredFields: [] };
        extractionStatus.value = emptyExtraction();
        transformStatus.value = emptyStatus();
        loadStatus.value = emptyStatus();
        error.value = null;
    }

    return {
        // State
        loading,
        error,
        loadPlan,
        extractionStatus,
        transformStatus,
        loadStatus,

        // Actions
        fetchLoadPlan,
        fetchTracebackCandidates,
        fetchSelectedTracebackField,
        saveTracebackField,
        startExtraction,
        fetchExtractionStatus,
        startTransform,
        fetchTransformStatus,
        startLoad,
        fetchLoadStatus,
        fetchLoadRecords,
        downloadLoadCsv,
        reset,
    };
});
