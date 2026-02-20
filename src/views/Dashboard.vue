<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { useOrgStore } from '@/stores/orgStore';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import axiosInstance from '@/api/axiosInstance';

import AddProjectDialog from '@/components/AddProjectDialog.vue';
import EditProjectDialog from '@/components/dashboard/EditProjectDialog.vue';
import OrgList from '@/components/dashboard/OrgList.vue';
import OrgFormDialog from '@/components/dashboard/OrgFormDialog.vue';
import ObjectList from '@/components/dashboard/ObjectList.vue';
import ObjectDetail from '@/components/dashboard/ObjectDetail.vue';

const orgStore = useOrgStore();
const toast = useToast();
const confirm = useConfirm();

// ─── State ──────────────────────────────────────────────
const orgFormVisible = ref(false);
const orgFormOrg = ref(null); // null = add mode, object = edit mode
const editProjectVisible = ref(false);
const analyzingOrgId = ref(null); // Track which specific org is being analyzed

// Org detail panel
const objects = ref([]);
const selectedObject = ref(null);
const fields = ref([]);
const loadingObjects = ref(false);
const loadingFields = ref(false);
const hasAnalysis = ref(false);
const checkingAnalysis = ref(false);

// ─── Computed ───────────────────────────────────────────
const projectOrgs = computed(() => orgStore.projectOrgs);
const selectedProject = computed(() => orgStore.selectedProject);
const selectedOrg = computed(() => orgStore.selectedOrg);

// ─── Lifecycle ──────────────────────────────────────────
onMounted(async () => {
    console.log('Dashboard mounted');
    await orgStore.loadProjects();

    // Check if returning from Salesforce OAuth flow with a pending analyze request
    const urlParams = new URLSearchParams(window.location.search);
    const autoAnalyzeOrgId = urlParams.get('autoAnalyzeOrgId');

    if (autoAnalyzeOrgId) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('autoAnalyzeOrgId');
        window.history.replaceState({}, '', cleanUrl);

        const org = orgStore.orgs.find(o => o.id === autoAnalyzeOrgId);
        if (org) {
            const project = orgStore.projects.find(p => p.id === org.projectId);
            if (project) orgStore.setSelectedProject(project);
            orgStore.setSelectedOrg(org);
            // Skip checkOrgAnalysis here — status may still be 'auth_required' from before OAuth,
            // which would re-redirect in a loop. Just call doAnalysis directly; it will
            // re-check auth synchronously and start the analysis fresh.
            doAnalysis();
        }
    } else if (orgStore.selectedOrg) {
        await checkOrgAnalysis(orgStore.selectedOrg.id);
    }
});

onUnmounted(() => {
    stopPolling();
});

// ─── Watchers ───────────────────────────────────────────

// When org selection changes, check for existing analysis
watch(selectedOrg, async (org) => {
    stopPolling();
    objects.value = [];
    selectedObject.value = null;
    fields.value = [];
    hasAnalysis.value = false;
    analyzingOrgId.value = null;

    if (org) {
        await checkOrgAnalysis(org.id);
    }
});

// ─── Project Actions ────────────────────────────────────
function onProjectChange(project) {
    orgStore.setSelectedProject(project);
}

function onCreateProject() {
    orgStore.showAddProjectDialog = true;
}

function onEditProject() {
    editProjectVisible.value = true;
}

function onDeleteProject() {
    if (!selectedProject.value) return;
    const project = selectedProject.value;
    confirm.require({
        message: `Are you sure you want to delete "${project.name}"? All orgs in this project will also be deleted. This cannot be undone.`,
        header: 'Confirm Delete Project',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Delete',
        rejectLabel: 'Cancel',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                const success = await orgStore.deleteProject(project.id);
                if (success) {
                    toast.add({ severity: 'success', summary: 'Deleted', detail: `Project "${project.name}" and its orgs have been deleted.`, life: 3000 });
                } else {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete project.', life: 3000 });
                }
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to delete project.', life: 3000 });
            }
        },
    });
}

// ─── Org Actions ────────────────────────────────────────
function onSelectOrg(org) {
    orgStore.setSelectedOrg(org);
}

function onAddOrg() {
    orgFormOrg.value = null;
    orgFormVisible.value = true;
}

function onEditOrg(org) {
    orgFormOrg.value = org;
    orgFormVisible.value = true;
}

function onOpenOrg(org) {
    window.open(org.loginURL, '_blank', 'noopener,noreferrer');
}

function onDeleteOrg(org) {
    confirm.require({
        message: `Are you sure you want to delete "${org.name}"? This cannot be undone.`,
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Delete',
        rejectLabel: 'Cancel',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                const success = await orgStore.deleteOrg(org.id);
                if (success) {
                    toast.add({ severity: 'success', summary: 'Deleted', detail: `${org.name} has been deleted.`, life: 3000 });
                } else {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete org.', life: 3000 });
                }
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to delete org.', life: 3000 });
            }
        },
    });
}

async function onOrgFormSaved() {
    await orgStore.loadProjects();
    if (orgStore.selectedOrg) {
        await checkOrgAnalysis(orgStore.selectedOrg.id);
    }
}

// ─── Analysis & Metadata ────────────────────────────────
let statusPollTimer = null;

// authUrl from backend is a relative path like /oauth2/auth?sfOrgId=...
// We must prefix with the backend base URL, not the frontend origin.
// We also pass returnTo so Salesforce redirects back here with autoAnalyzeOrgId set.
function oauthRedirect(authUrl, orgId) {
    const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '';
    const returnTo = `${window.location.origin}${window.location.pathname}?autoAnalyzeOrgId=${orgId}`;
    window.location.href = `${base}${authUrl}&returnTo=${encodeURIComponent(returnTo)}`;
}

function stopPolling() {
    if (statusPollTimer !== null) {
        clearInterval(statusPollTimer);
        statusPollTimer = null;
    }
}

function startPolling(orgId) {
    stopPolling();
    statusPollTimer = setInterval(async () => {
        // Stop polling if org has changed
        if (selectedOrg.value?.id !== orgId) {
            stopPolling();
            return;
        }
        try {
            const res = await axiosInstance.get('/api', {
                headers: { action: 'get-org-status', orgid: orgId },
            });
            const status = res.data.data?.analysisStatus;
            if (status === 'complete') {
                stopPolling();
                analyzingOrgId.value = null;
                await checkOrgAnalysis(orgId);
            } else if (status === 'failed') {
                stopPolling();
                analyzingOrgId.value = null;
                toast.add({ severity: 'error', summary: 'Analysis Failed', detail: 'Org analysis failed. Please try again.', life: 5000 });
            } else if (status === 'auth_required') {
                stopPolling();
                analyzingOrgId.value = null;
                oauthRedirect(res.data.data.authUrl, orgId);
            }
        } catch (e) {
            console.error('Status poll error:', e);
        }
    }, 3000);
}

async function checkOrgAnalysis(orgId) {
    checkingAnalysis.value = true;
    try {
        // Fetch objects
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

        // Also check running status
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
    const orgId = selectedOrg.value.id;
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

function onAnalyzeOrg() {
    doAnalysis();
}

function onSelectObject(obj) {
    selectedObject.value = obj;
    fields.value = [];
    onLoadFields(obj);
}

async function onLoadFields(obj) {
    loadingFields.value = true;
    try {
        const response = await axiosInstance.get('/api', {
            headers: {
                action: 'get-fields',
                objectid: obj.id,
            },
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
</script>

<template>
    <div class="dashboard">
        <!-- ─── Content: Orgs + Detail ────────────────────── -->
        <div class="dashboard-content">
            <!-- Left Column: Project + Org List -->
            <div class="left-column">
                <!-- Project Panel -->
                <div class="dashboard-panel project-panel">
                    <div class="project-list-header">
                        <h3>Projects</h3>
                        <Select
                            v-model="orgStore.selectedProject"
                            :options="orgStore.projects"
                            optionLabel="name"
                            placeholder="Select Project"
                            class="project-select"
                            @change="onProjectChange($event.value)"
                        />
                        <Button
                            icon="pi pi-plus"
                            label="Add Project"
                            size="small"
                            severity="success"
                            outlined
                            @click="onCreateProject"
                        />
                    </div>

                    <!-- Selected Project Display -->
                    <div v-if="selectedProject" class="project-item">
                        <div class="project-item-info">
                            <span class="project-item-name">{{ selectedProject.name }}</span>
                            <span v-if="selectedProject.description" class="project-item-desc">{{ selectedProject.description }}</span>
                        </div>
                        <div class="project-item-actions">
                            <Button
                                icon="pi pi-pencil"
                                size="small"
                                severity="secondary"
                                text
                                rounded
                                @click="onEditProject"
                                v-tooltip.top="'Edit Project'"
                            />
                            <Button
                                icon="pi pi-trash"
                                size="small"
                                severity="danger"
                                text
                                rounded
                                @click="onDeleteProject"
                                v-tooltip.top="'Delete Project'"
                            />
                        </div>
                    </div>
                </div>

                <!-- Org List Panel -->
                <div v-if="selectedProject" class="dashboard-panel org-panel">
                    <OrgList
                        :orgs="projectOrgs"
                        :selectedOrg="selectedOrg"
                        @select-org="onSelectOrg"
                        @add-org="onAddOrg"
                        @edit-org="onEditOrg"
                        @delete-org="onDeleteOrg"
                        @open-org="onOpenOrg"
                    />
                </div>

                <!-- No Project Selected -->
                <div v-else class="dashboard-panel org-panel org-panel-empty">
                    <div class="empty-org-content">
                        <i class="pi pi-arrow-up" style="font-size: 2rem; color: var(--text-color-secondary);"></i>
                        <p>Select a project to get started</p>
                    </div>
                </div>
            </div>

            <!-- Right: Org Detail -->
            <div v-if="selectedProject && selectedOrg" class="dashboard-panel detail-panel">
                <div class="detail-header">
                    <h2>{{ selectedOrg.name }}</h2>
                    <span v-if="selectedOrg.description" class="detail-desc">{{ selectedOrg.description }}</span>
                </div>

                <!-- Shared content area — overlay covers both first-analyze and re-analyze -->
                <div class="detail-body">

                    <!-- Analysis overlay spinner (shown during any analysis) -->
                    <div v-if="analyzingOrgId" class="analysis-overlay">
                        <ProgressSpinner style="width: 3rem; height: 3rem;" />
                        <span>Analyzing org&hellip;</span>
                    </div>

                    <!-- Loading state -->
                    <div v-if="checkingAnalysis" class="detail-loading">
                        <ProgressSpinner style="width: 2rem; height: 2rem;" />
                        <span>Checking for existing analysis...</span>
                    </div>

                    <!-- No analysis -->
                    <template v-else-if="!hasAnalysis">
                        <div class="no-analysis">
                            <i class="pi pi-search" style="font-size: 2rem; color: var(--text-color-secondary);"></i>
                            <p>No analysis found for this org.</p>
                            <Button
                                label="Analyze Org"
                                icon="pi pi-cloud-download"
                                @click="onAnalyzeOrg"
                            />
                        </div>
                    </template>

                    <!-- Has analysis -->
                    <template v-else>
                        <div class="analysis-actions">
                            <Button
                                label="Re-Analyze Org"
                                icon="pi pi-refresh"
                                size="small"
                                severity="warning"
                                outlined
                                @click="onAnalyzeOrg"
                            />
                        </div>

                        <div class="analysis-content">

                        <!-- Left Column: Object List + Object Detail Header -->
                        <div class="left-column">
                            <!-- Object List -->
                            <div class="analysis-panel">
                                <ObjectList
                                    :objects="objects"
                                    :selectedObject="selectedObject"
                                    :loading="loadingObjects"
                                    @select-object="onSelectObject"
                                />
                            </div>

                            <!-- Object Detail Header -->
                            <div v-if="selectedObject" class="analysis-panel">
                                <ObjectDetail
                                    :object="selectedObject"
                                />
                            </div>
                        </div>

                        <!-- Right: Field List -->
                        <div v-if="selectedObject" class="analysis-panel">
                            <FieldList :fields="fields" :loading="loadingFields" />
                        </div>
                    </div>
                </template>

                </div><!-- /detail-body -->
            </div>

            <!-- No org selected placeholder -->
            <div v-else-if="selectedProject" class="dashboard-panel detail-panel detail-placeholder">
                <i class="pi pi-arrow-left" style="font-size: 2rem; color: var(--text-color-secondary);"></i>
                <p>Select an org to view its details</p>
            </div>
        </div>

        <!-- ─── Dialogs ──────────────────────────────────── -->
        <OrgFormDialog
            v-model:visible="orgFormVisible"
            :org="orgFormOrg"
            :projectId="selectedProject?.id"
            @saved="onOrgFormSaved"
        />

        <AddProjectDialog />

        <EditProjectDialog
            v-model:visible="editProjectVisible"
            :project="selectedProject"
            @saved="onOrgFormSaved"
        />

        <ConfirmDialog />
    </div>
</template>

<style scoped>
.dashboard {
    display: flex;
    flex-direction: column;
    padding: 1rem;
}

.dashboard-content {
    display: grid;
    grid-template-columns: 350px 1fr;
    gap: 1.5rem;
    align-items: start;
}

.left-column {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.project-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.project-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
}

.project-list-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    white-space: nowrap;
}

.project-select {
    flex: 1;
    min-width: 0;
}

.project-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border: 2px solid;
    border-color: var(--p-sky-500);
    border-radius: 8px;
    background-color: var(--p-sky-50);
}

:root.app-dark .project-item {
    background-color: color-mix(in srgb, var(--p-sky-500) 18%, transparent);
}

.project-item-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
    min-width: 0;
}

.project-item-name {
    font-weight: 500;
}

.project-item-desc {
    font-size: 0.85rem;
    color: var(--text-color-secondary);
}

.project-item-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
}

.empty-org-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem;
    color: var(--text-color-secondary);
    text-align: center;
}

.empty-org-content p {
    margin: 0;
}

.org-panel-empty {
    min-height: auto;
}

.dashboard-panel {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    padding: 1.25rem;
}

.org-panel {
    min-height: 200px;
}

.detail-panel {
    min-height: 300px;
}

.detail-body {
    position: relative;
}

.detail-header {
    margin-bottom: 1rem;
}

.detail-header h2 {
    margin: 0 0 0.25rem 0;
    font-size: 1.3rem;
}

.detail-desc {
    font-size: 0.9rem;
    color: var(--text-color-secondary);
}

.detail-loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    justify-content: center;
    color: var(--text-color-secondary);
}

.no-analysis {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--text-color-secondary);
}

.analysis-actions {
    margin-bottom: 1rem;
}

.analysis-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    align-items: start;
}

.analysis-overlay {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.75);
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    border-radius: 8px;
    font-size: 0.95rem;
    color: var(--text-color-secondary);
}

.left-column {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.analysis-panel {
    background: var(--surface-ground);
    border-radius: 8px;
    padding: 1rem;
}

.detail-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--text-color-secondary);
}

@media (max-width: 1200px) {
    .analysis-content {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 768px) {
    .dashboard-content {
        grid-template-columns: 1fr;
    }
}
</style>
