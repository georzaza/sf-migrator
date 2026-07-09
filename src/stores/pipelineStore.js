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
    const extractionPreview = ref({ sourceOrgId: null, targetOrgId: null, objects: [] });
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

    // ==================== Traceback (source -> target correlation) ====================

    /**
     * Returns the tiered candidate lists + names of user-mapped target fields:
     *   { external: [...], unique: [...], alphanumeric: [...], composite: [...],
     *     mappedTargetFieldNames: [...] }
     */
    async function fetchTracebackCandidates(targetObjectId, sourceObjectId = null) {
        const headers = { action: 'get-traceback-candidates', targetObjectId };
        if (sourceObjectId) headers.sourceObjectId = sourceObjectId;
        const response = await axiosInstance.get('/api', { headers });
        return response.data.data || { external: [], unique: [], alphanumeric: [], composite: [], mappedTargetFieldNames: [] };
    }

    /**
     * Returns the stored traceback config for a pair, or { strategy: null, fields: [] }.
     * Legacy `metadata.tracebackExternalIdField` is auto-translated server-side.
     */
    async function fetchTraceback(sourceObjectId, targetObjectId) {
        const response = await axiosInstance.get('/api', {
            headers: { action: 'get-migration-setting', sourceObjectId, targetObjectId },
        });
        const meta = response.data.data?.metadata || {};
        if (meta.traceback?.strategy && Array.isArray(meta.traceback.fields)) {
            return { strategy: meta.traceback.strategy, fields: meta.traceback.fields };
        }
        const legacy = meta.tracebackExternalIdField;
        if (legacy?.id && legacy?.name) {
            return { strategy: 'external-id', fields: [{ id: legacy.id, name: legacy.name }] };
        }
        return { strategy: null, fields: [] };
    }

    /**
     * Persist the traceback config. Pass `null` to clear.
     * `selection`: { strategy: 'external-id'|'unique'|'alphanumeric'|'composite', fieldIds: string[] }
     */
    async function saveTraceback(sourceObjectId, targetObjectId, selection) {
        const body = {
            sourceObjectId,
            targetObjectId,
            strategy: selection?.strategy ?? null,
            fieldIds: selection?.fieldIds ?? [],
        };
        const response = await axiosInstance.put('/api', body, {
            headers: { action: 'set-traceback' },
        });
        return response.data.data || { strategy: null, fields: [] };
    }

    // ==================== Extraction (source org) ====================

    async function startExtraction(sourceOrgId, sourceObjectIds = null) {
        extractionStatus.value = { ...emptyExtraction(), extractionStatus: 'running' };
        const body = { sourceOrgId };
        if (Array.isArray(sourceObjectIds) && sourceObjectIds.length > 0) {
            body.sourceObjectIds = sourceObjectIds;
        }
        const response = await axiosInstance.post('/api', body, {
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

    async function fetchExtractionPreview(sourceOrgId, targetOrgId = null) {
        const headers = { action: 'get-extraction-preview', sourceOrgId };
        if (targetOrgId) headers.targetOrgId = targetOrgId;
        const response = await axiosInstance.get('/api', { headers });
        extractionPreview.value = response.data.data || { sourceOrgId, targetOrgId, objects: [] };
        return extractionPreview.value;
    }

    async function saveSourceExtractFilter(sourceObjectId, extractFilter) {
        const response = await axiosInstance.put('/api',
            { sourceObjectId, extractFilter },
            { headers: { action: 'set-source-extract-filter' } },
        );
        const saved = response.data.data || { sourceObjectId, extractFilter: null };
        // Reflect into the local preview if present.
        const row = extractionPreview.value.objects?.find((o) => o.id === sourceObjectId);
        if (row) row.extractFilter = saved.extractFilter;
        return saved;
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
        extractionPreview.value = { sourceOrgId: null, targetOrgId: null, objects: [] };
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
        extractionPreview,
        transformStatus,
        loadStatus,

        // Actions
        fetchLoadPlan,
        fetchTracebackCandidates,
        fetchTraceback,
        saveTraceback,
        startExtraction,
        fetchExtractionStatus,
        fetchExtractionPreview,
        saveSourceExtractFilter,
        startTransform,
        fetchTransformStatus,
        startLoad,
        fetchLoadStatus,
        fetchLoadRecords,
        downloadLoadCsv,
        reset,
    };
});
