import { ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { usePipelineStore } from '@/stores/pipelineStore';

/**
 * Encapsulates the run/poll lifecycle for the migration pipeline (transform then
 * load), with live object-by-object progress. Mirrors the polling pattern used by
 * useOrgAnalysis. Must be called from within a component's setup().
 */
export function usePipeline() {
    const store = usePipelineStore();
    const toast = useToast();

    const POLL_INTERVAL = 2500;

    // 'idle' | 'transform' | 'load' | 'complete' | 'failed'
    const currentStage = ref('idle');
    const running = ref(false);
    const extracting = ref(false);

    const extractionTimer = ref(null);
    const transformTimer = ref(null);
    const loadTimer = ref(null);

    function stopPolling() {
        if (extractionTimer.value) { clearInterval(extractionTimer.value); extractionTimer.value = null; }
        if (transformTimer.value) { clearInterval(transformTimer.value); transformTimer.value = null; }
        if (loadTimer.value) { clearInterval(loadTimer.value); loadTimer.value = null; }
    }

    // Poll a status fetcher until it reports a terminal state.
    function pollUntilTerminal(fetchFn, timerRef) {
        return new Promise((resolve) => {
            timerRef.value = setInterval(async () => {
                try {
                    const status = await fetchFn();
                    if (status.status === 'complete' || status.status === 'failed') {
                        clearInterval(timerRef.value);
                        timerRef.value = null;
                        resolve(status);
                    }
                } catch (e) {
                    // Transient poll error — keep polling.
                    console.error('Pipeline poll error:', e);
                }
            }, POLL_INTERVAL);
        });
    }

    // Poll extraction status until terminal. Extraction uses a different status
    // field name ('extractionStatus') than transform/load.
    function pollExtractionUntilTerminal(sourceOrgId) {
        return new Promise((resolve) => {
            extractionTimer.value = setInterval(async () => {
                try {
                    const status = await store.fetchExtractionStatus(sourceOrgId);
                    const s = status.extractionStatus;
                    if (s === 'complete' || s === 'failed' || s === 'auth_failed') {
                        clearInterval(extractionTimer.value);
                        extractionTimer.value = null;
                        resolve(status);
                    }
                } catch (e) {
                    console.error('Extraction poll error:', e);
                }
            }, POLL_INTERVAL);
        });
    }

    async function runExtraction(sourceOrgId, sourceObjectIds = null) {
        if (extracting.value) return;
        extracting.value = true;
        let res;
        try {
            res = await store.startExtraction(sourceOrgId, sourceObjectIds);
        } catch (err) {
            const detail = err.response?.status === 401
                ? 'Authentication required — log in to the source org from the workspace first.'
                : err.response?.data?.message || err.message || 'Failed to start extraction';
            toast.add({ severity: 'error', summary: 'Extraction', detail, life: 6000 });
            extracting.value = false;
            return { extractionStatus: 'failed', error: detail };
        }
        if (res.status === 401) {
            toast.add({
                severity: 'warn',
                summary: 'Authentication required',
                detail: 'Log in to the source org from the workspace, then retry extraction.',
                life: 7000,
            });
            extracting.value = false;
            return { extractionStatus: 'auth_failed' };
        }
        if (res.status !== 202 || !res.data?.success) {
            const detail = res.data?.message || 'Failed to start extraction';
            toast.add({ severity: 'error', summary: 'Extraction', detail, life: 5000 });
            extracting.value = false;
            return { extractionStatus: 'failed', error: detail };
        }

        const final = await pollExtractionUntilTerminal(sourceOrgId);
        if (final.extractionStatus === 'complete') {
            const failed = final.summary?.failedCount ?? 0;
            toast.add({
                severity: failed > 0 ? 'warn' : 'success',
                summary: failed > 0 ? 'Extraction completed with errors' : 'Extraction complete',
                detail: `Objects: ${final.summary?.totalObjects ?? 0}, success: ${final.summary?.successCount ?? 0}, failed: ${failed}`,
                life: 6000,
            });
        } else {
            toast.add({ severity: 'error', summary: 'Extraction failed', detail: final.error || 'Extraction failed', life: 7000 });
        }
        extracting.value = false;
        return final;
    }

    async function runTransform(sourceOrgId, targetOrgId) {
        currentStage.value = 'transform';
        let res;
        try {
            res = await store.startTransform(sourceOrgId, targetOrgId);
        } catch (err) {
            const detail = err.response?.data?.message || err.message || 'Failed to start transform';
            toast.add({ severity: 'error', summary: 'Transform', detail, life: 5000 });
            return { status: 'failed', error: detail };
        }
        if (res.status !== 202 || !res.data?.success) {
            const detail = res.data?.message || 'Failed to start transform';
            toast.add({ severity: 'error', summary: 'Transform', detail, life: 5000 });
            return { status: 'failed', error: detail };
        }

        const final = await pollUntilTerminal(() => store.fetchTransformStatus(sourceOrgId, targetOrgId), transformTimer);
        if (final.status === 'complete') {
            const s = final.summary;
            const failed = s?.failedCount ?? 0;
            toast.add({
                severity: failed > 0 ? 'warn' : 'success',
                summary: failed > 0 ? 'Transform completed with errors' : 'Transform complete',
                detail: `Objects: ${s?.targetObjectCount ?? 0}, success: ${s?.successCount ?? 0}, failed: ${failed}`,
                life: 6000,
            });
        } else {
            toast.add({ severity: 'error', summary: 'Transform failed', detail: final.error || 'Transform failed', life: 7000 });
        }
        return final;
    }

    async function runLoad(sourceOrgId, targetOrgId) {
        currentStage.value = 'load';
        let res;
        try {
            res = await store.startLoad(sourceOrgId, targetOrgId);
        } catch (err) {
            const detail = err.response?.data?.message || err.message || 'Failed to start load';
            toast.add({ severity: 'error', summary: 'Load', detail, life: 5000 });
            return { status: 'failed', error: detail };
        }
        if (res.status !== 202 || !res.data?.success) {
            const detail = res.data?.message || 'Failed to start load';
            toast.add({ severity: 'error', summary: 'Load', detail, life: 5000 });
            return { status: 'failed', error: detail };
        }

        const final = await pollUntilTerminal(() => store.fetchLoadStatus(sourceOrgId, targetOrgId), loadTimer);
        if (final.status === 'complete') {
            const results = final.summary?.results || [];
            const loaded = results.reduce((sum, r) => sum + (r.loaded || 0), 0);
            const failed = results.reduce((sum, r) => sum + (r.failed || 0), 0);
            toast.add({
                severity: failed > 0 ? 'warn' : 'success',
                summary: failed > 0 ? 'Load completed with errors' : 'Load complete',
                detail: `Objects: ${final.summary?.objectCount ?? 0}, loaded: ${loaded}, failed: ${failed}`,
                life: 7000,
            });
        } else {
            toast.add({ severity: 'error', summary: 'Load failed', detail: final.error || 'Load failed', life: 7000 });
        }
        return final;
    }

    /**
     * Run the whole pipeline: transform, then (only on success) load.
     */
    async function runMigration(sourceOrgId, targetOrgId) {
        if (running.value) return;
        running.value = true;
        try {
            const transformResult = await runTransform(sourceOrgId, targetOrgId);
            if (transformResult.status !== 'complete') {
                currentStage.value = 'failed';
                return;
            }
            const loadResult = await runLoad(sourceOrgId, targetOrgId);
            currentStage.value = loadResult.status === 'complete' ? 'complete' : 'failed';
        } finally {
            running.value = false;
        }
    }

    /**
     * If a run is already in flight server-side (e.g. after navigating back),
     * resume polling and reflect the active stage.
     */
    async function resumeIfRunning(sourceOrgId, targetOrgId) {
        try {
            const [extraction, transform, load] = await Promise.all([
                store.fetchExtractionStatus(sourceOrgId),
                store.fetchTransformStatus(sourceOrgId, targetOrgId),
                store.fetchLoadStatus(sourceOrgId, targetOrgId),
            ]);
            if (extraction.extractionStatus === 'running') {
                extracting.value = true;
                pollExtractionUntilTerminal(sourceOrgId).finally(() => { extracting.value = false; });
            }
            if (load.status === 'running') {
                running.value = true;
                currentStage.value = 'load';
                pollUntilTerminal(() => store.fetchLoadStatus(sourceOrgId, targetOrgId), loadTimer)
                    .finally(() => { running.value = false; });
            } else if (transform.status === 'running') {
                running.value = true;
                currentStage.value = 'transform';
                pollUntilTerminal(() => store.fetchTransformStatus(sourceOrgId, targetOrgId), transformTimer)
                    .finally(() => { running.value = false; });
            }
        } catch (e) {
            console.error('resumeIfRunning error:', e);
        }
    }

    return {
        currentStage,
        running,
        extracting,
        runExtraction,
        runTransform,
        runLoad,
        runMigration,
        resumeIfRunning,
        stopPolling,
    };
}
