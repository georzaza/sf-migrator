<script setup>
import { ref, watch, computed, onMounted } from 'vue';
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
    await orgStore.loadProjects();
    // If there's already a selected org (e.g., after page refresh), check its analysis
    if (orgStore.selectedOrg) {
        await checkOrgAnalysis(orgStore.selectedOrg.id);
    }
});

// ─── Watchers ───────────────────────────────────────────

// When org selection changes, check for existing analysis
watch(selectedOrg, async (org) => {
    objects.value = [];
    selectedObject.value = null;
    fields.value = [];
    hasAnalysis.value = false;

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
async function checkOrgAnalysis(orgId) {
    checkingAnalysis.value = true;
    try {
        const response = await axiosInstance.get('/', {
            headers: {
                action: 'get-objects',
                orgid: orgId,
            },
        });
        if (response.data.success && response.data.data.length > 0) {
            hasAnalysis.value = true;
            objects.value = response.data.data;
        } else {
            hasAnalysis.value = false;
            objects.value = [];
        }
    } catch {
        hasAnalysis.value = false;
        objects.value = [];
    } finally {
        checkingAnalysis.value = false;
    }
}

function onAnalyzeOrg() {
    const doAnalysis = async () => {
        analyzingOrgId.value = selectedOrg.value.id;
        try {
            // start analysis asynchronously on server
            const response = await axiosInstance.post('/', {
                orgId: selectedOrg.value.id,
                options: { includeCustomOnly: false },
            }, {
                headers: { action: 'start-analysis' },
            });

            if (response.data.success) {
                // Poll for latest analysis and refresh objects when complete
                const analysisPolling = setInterval(async () => {
                    try {
                        const latest = await axiosInstance.get('/analysis', {
                            headers: { action: 'get-latest-analysis', orgid: selectedOrg.value.id }
                        });
                        if (latest.data.success && latest.data.data) {
                            const status = latest.data.data.status;
                            if (status === 'in_progress' || status === 'pending') {
                                loadingObjects.value = true;
                            }
                            if (status === 'completed') {
                                clearInterval(analysisPolling);
                                loadingObjects.value = false;
                                analyzingOrgId.value = null;
                                toast.add({ severity: 'success', summary: 'Analysis Complete', detail: `Analysis for ${selectedOrg.value.name} is complete.`, life: 4000 });
                                await checkOrgAnalysis(selectedOrg.value.id);
                            }
                            if (status === 'failed') {
                                clearInterval(analysisPolling);
                                loadingObjects.value = false;
                                analyzingOrgId.value = null;
                                toast.add({ severity: 'error', summary: 'Analysis Failed', detail: `Analysis for ${selectedOrg.value.name} failed.`, life: 6000 });
                            }
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }, 3000);
            } else {
                toast.add({ severity: 'error', summary: 'Error', detail: response.data.message || 'Failed to start analysis.', life: 4000 });
                analyzingOrgId.value = null;
            }
        } catch (error) {
            toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || error.message || 'Failed to start analysis.', life: 4000 });
            analyzingOrgId.value = null;
        }
    };

    if (hasAnalysis.value) {
        confirm.require({
            message: 'Starting a new analysis will take a while to complete and all metadata previously retrieved from Salesforce for this org will be lost. Continue?',
            header: 'Confirm Re-Analysis',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Continue',
            rejectLabel: 'Cancel',
            accept: doAnalysis,
        });
        return;
    }
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
        const response = await axiosInstance.get('/', {
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
                            :loading="analyzingOrgId === selectedOrg?.id"
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
                            :loading="analyzingOrgId === selectedOrg?.id"
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
