import { ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useOrgStore } from '@/stores/orgStore';
import axiosInstance from '@/api/axiosInstance';

/**
 * Encapsulates all analysis state and logic for a Salesforce org.
 * Must be called from within a component's <script setup> (or setup()).
 */
export function useOrgAnalysis() {
    const orgStore = useOrgStore();
    const toast = useToast();

    // ─── State ──────────────────────────────────────────
    const analyzingOrgId = ref(null);
    const objects = ref([]);
    const selectedObject = ref(null);
    const fields = ref([]);
    const loadingObjects = ref(false);
    const loadingFields = ref(false);
    const hasAnalysis = ref(false);
    const checkingAnalysis = ref(false);

    // Keyed by orgId so switching orgs never cancels an in-flight background analysis.
    const statusPollTimers = new Map();

    // ─── Helpers ────────────────────────────────────────

    // authUrl from backend is relative (/oauth2/auth?sfOrgId=...).
    // Prefix with VITE_API_URL (backend origin) so the redirect goes to port 3000, not 5173.
    // Append returnTo so Salesforce bounces back here with autoAnalyzeOrgId set.
    function oauthRedirect(authUrl, orgId) {
        const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '';
        const returnTo = `${window.location.origin}${window.location.pathname}?autoAnalyzeOrgId=${orgId}`;
        window.location.href = `${base}${authUrl}&returnTo=${encodeURIComponent(returnTo)}`;
    }

    // ─── Polling ────────────────────────────────────────

    // Stop the poll for a specific org, or all polls when called without an argument (onUnmounted).
    function stopPolling(orgId) {
        if (orgId) {
            const timer = statusPollTimers.get(orgId);
            if (timer !== undefined) {
                clearInterval(timer);
                statusPollTimers.delete(orgId);
            }
        } else {
            statusPollTimers.forEach(timer => clearInterval(timer));
            statusPollTimers.clear();
        }
    }

    function startPolling(orgId) {
        stopPolling(orgId); // cancel any existing poll for this org only
        const timer = setInterval(async () => {
            try {
                const res = await axiosInstance.get('/api', {
                    headers: { action: 'get-org-status', orgid: orgId },
                });
                const status = res.data.data?.analysisStatus;
                if (status === 'complete') {
                    stopPolling(orgId);
                    if (analyzingOrgId.value === orgId) analyzingOrgId.value = null;
                    const completedOrg = orgStore.orgs.find(o => o.id === orgId);
                    const completedProject = completedOrg
                        ? orgStore.projects.find(p => p.id === completedOrg.projectId)
                        : null;
                    toast.add({
                        severity: 'success',
                        summary: 'Analysis Complete',
                        detail: completedOrg
                            ? `${completedProject ? completedProject.name + ' › ' : ''}${completedOrg.name} analysis finished successfully.`
                            : 'Org analysis finished successfully.',
                        life: 6000,
                    });
                    // Only refresh the objects panel if the user is still on this org
                    if (orgStore.selectedOrg?.id === orgId) {
                        await checkOrgAnalysis(orgId);
                    }
                } else if (status === 'failed') {
                    stopPolling(orgId);
                    if (analyzingOrgId.value === orgId) analyzingOrgId.value = null;
                    const failedOrg = orgStore.orgs.find(o => o.id === orgId);
                    const failedProject = failedOrg
                        ? orgStore.projects.find(p => p.id === failedOrg.projectId)
                        : null;
                    toast.add({
                        severity: 'error',
                        summary: 'Analysis Failed',
                        detail: failedOrg
                            ? `${failedProject ? failedProject.name + ' › ' : ''}${failedOrg.name} analysis failed. Please try again.`
                            : 'Org analysis failed. Please try again.',
                        life: 5000,
                    });
                } else if (status === 'auth_required') {
                    stopPolling(orgId);
                    if (analyzingOrgId.value === orgId) analyzingOrgId.value = null;
                    oauthRedirect(res.data.data.authUrl, orgId);
                }
            } catch (e) {
                console.error('Status poll error:', e);
            }
        }, 3000);
        statusPollTimers.set(orgId, timer);
    }

    // ─── Analysis ───────────────────────────────────────

    async function checkOrgAnalysis(orgId) {
        checkingAnalysis.value = true;
        try {
            const objRes = await axiosInstance.get('/api', {
                headers: { action: 'get-objects', orgid: orgId },
            });
            if (objRes.data.success && objRes.data.data.length > 0) {
                hasAnalysis.value = true;
                objects.value = objRes.data.data;
            } else {
                hasAnalysis.value = false;
                objects.value = [];
            }

            const statusRes = await axiosInstance.get('/api', {
                headers: { action: 'get-org-status', orgid: orgId },
            });
            const analysisStatus = statusRes.data.data?.analysisStatus;
            if (analysisStatus === 'running') {
                analyzingOrgId.value = orgId;
                startPolling(orgId);
            } else if (analysisStatus === 'auth_required') {
                oauthRedirect(statusRes.data.data.authUrl, orgId);
            }
        } catch {
            hasAnalysis.value = false;
            objects.value = [];
        } finally {
            checkingAnalysis.value = false;
        }
    }

    async function doAnalysis() {
        const orgId = orgStore.selectedOrg?.id;
        if (!orgId) return;
        try {
            const response = await axiosInstance.post('/api', {
                orgId,
                includeCustomOnly: false,
            }, {
                headers: { action: 'analyze-org' },
            });
            if (response.status === 202 && response.data.success) {
                analyzingOrgId.value = orgId;
                startPolling(orgId);
            } else if (response.status === 401 && response.data.authUrl) {
                oauthRedirect(response.data.authUrl, orgId);
            } else {
                toast.add({ severity: 'error', summary: 'Error', detail: response.data.message || 'Failed to start analysis.', life: 4000 });
            }
        } catch (error) {
            if (error.response?.status === 401 && error.response?.data?.authUrl) {
                oauthRedirect(error.response.data.authUrl, orgId);
            } else {
                toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || error.message || 'Failed to analyze org.', life: 4000 });
            }
        }
    }

    // ─── Object / Field selection ────────────────────────

    async function onSelectObject(obj) {
        selectedObject.value = obj;
        fields.value = [];
        await loadFields(obj);
    }

    async function loadFields(obj) {
        loadingFields.value = true;
        try {
            const response = await axiosInstance.get('/api', {
                headers: { action: 'get-fields', objectid: obj.id },
            });
            if (response.data.success) {
                fields.value = response.data.data;
            }
        } catch {
            toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load fields.', life: 3000 });
        } finally {
            loadingFields.value = false;
        }
    }

    // ─── Reset (called when selected org changes) ────────

    // Reset visual state when switching orgs — intentionally does NOT stop background polls
    // so in-progress analyses can still complete and fire their toast.
    function resetState() {
        objects.value = [];
        selectedObject.value = null;
        fields.value = [];
        hasAnalysis.value = false;
        analyzingOrgId.value = null;
    }

    // ─── Public API ─────────────────────────────────────

    return {
        // State (all refs)
        analyzingOrgId,
        objects,
        selectedObject,
        fields,
        loadingObjects,
        loadingFields,
        hasAnalysis,
        checkingAnalysis,
        // Functions
        checkOrgAnalysis,
        doAnalysis,
        stopPolling,
        resetState,
        onSelectObject,
    };
}
