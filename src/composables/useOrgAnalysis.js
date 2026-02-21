import { ref, nextTick } from 'vue';
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
    const loadingFields = ref(false);
    const hasAnalysis = ref(false);
    const checkingAnalysis = ref(false);

    // Keyed by orgId so switching orgs never cancels an in-flight background analysis.
    const statusPollTimers = new Map();

    // ─── OAuth overlay state (consumed by OAuthRedirectOverlay.vue via Teleport) ─
    const showingOAuthOverlay = ref(false);
    const oauthOrgName = ref('');

    // ─── Helpers ────────────────────────────────────────

    // authUrl from backend is relative (/oauth2/auth?sfOrgId=...).
    // Prefix with VITE_API_URL (backend origin) so the redirect goes to port 3000, not 5173.
    // Append returnTo so Salesforce bounces back here with autoAnalyzeOrgId set.
    function buildOAuthUrl(authUrl, orgId) {
        const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '';
        const returnTo = `${window.location.origin}${window.location.pathname}?autoAnalyzeOrgId=${orgId}`;
        return `${base}${authUrl}&returnTo=${encodeURIComponent(returnTo)}`;
    }

    // Guard against concurrent calls (e.g. doAnalysis + poll both detecting auth_required).
    let oauthPopupActive = false;

    // Show overlay, then open a popup for Salesforce OAuth.
    // The callback page sends a postMessage on success/error and closes itself.
    // If the popup is closed without a message (e.g. redirect_uri_mismatch error on Salesforce's page)
    // we detect it via polling and show a helpful toast.
    async function triggerOAuthRedirect(authUrl, orgId) {
        if (oauthPopupActive) {
            console.log('[oauthRedirect] Already handling an OAuth popup — ignoring duplicate call.');
            return;
        }
        oauthPopupActive = true;

        const orgName = orgStore.orgs.find(o => o.id === orgId)?.name ?? 'this org';
        const fullUrl = buildOAuthUrl(authUrl, orgId);

        oauthOrgName.value = orgName;
        showingOAuthOverlay.value = true;
        await nextTick();

        // Centre the popup on screen.
        const w = 700, h = 700;
        const left = Math.max(0, (window.screen.width - w) / 2);
        const top  = Math.max(0, (window.screen.height - h) / 2);
        const popup = window.open(
            fullUrl, 'sf_oauth',
            `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );

        if (!popup || popup.closed) {
            // Popup blocked — fall back to full-page redirect.
            oauthPopupActive = false;
            showingOAuthOverlay.value = false;
            setTimeout(() => { window.location.href = fullUrl; }, 500);
            return;
        }

        const expectedOrigin = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '';

        await new Promise((resolve) => {
            let settled = false;

            function settle(fn) {
                if (settled) return;
                settled = true;
                cleanup();
                showingOAuthOverlay.value = false;
                oauthPopupActive = false;
                fn();
                resolve();
            }

            function onMessage(event) {
                if (event.origin !== expectedOrigin) return;
                const { type, message } = event.data ?? {};

                if (type === 'sf-oauth-success') {
                    settle(() => doAnalysis());
                } else if (type === 'sf-oauth-error') {
                    settle(() => toast.add({ severity: 'error', summary: 'Authorization Failed', detail: message, life: 10000 }));
                }
            }

            // Poll for popup closed without a postMessage — happens when the user manually
            // closes the window before completing OAuth (e.g. redirect_uri_mismatch on Salesforce's page).
            // The popup page itself no longer calls window.close(), so popup.closed only becomes
            // true when the user closes it — no race with the message event.
            const pollTimer = setInterval(() => {
                if (!popup.closed) return;
                const callbackUrl = `${expectedOrigin}/oauth2/callback`;
                settle(() => toast.add({
                    severity: 'warn',
                    summary: 'Authorization Incomplete',
                    detail: `The authorization window was closed before completing. If you saw a "redirect_uri_mismatch" error on Salesforce, make sure the Connected App's Callback URL is set to: ${callbackUrl}`,
                }));
            }, 500);

            function cleanup() {
                window.removeEventListener('message', onMessage);
                clearInterval(pollTimer);
                if (!popup.closed) popup.close();
            }

            window.addEventListener('message', onMessage);
        });
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
                    triggerOAuthRedirect(res.data.data.authUrl, orgId);
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
                triggerOAuthRedirect(statusRes.data.data.authUrl, orgId);
            }
        } catch (e) {
            console.error('checkOrgAnalysis error:', e);
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
                triggerOAuthRedirect(response.data.authUrl, orgId);
            } else {
                toast.add({ severity: 'error', summary: 'Error', detail: response.data.message || 'Failed to start analysis.', life: 4000 });
            }
        } catch (error) {
            if (error.response?.status === 401 && error.response?.data?.authUrl) {
                triggerOAuthRedirect(error.response.data.authUrl, orgId);
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
        showingOAuthOverlay,
        oauthOrgName,
        objects,
        selectedObject,
        fields,
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
