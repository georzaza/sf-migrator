<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { useOrgStore } from '@/stores/orgStore';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

import { useOrgAnalysis } from '@/composables/useOrgAnalysis';
import AddProjectDialog from '@/components/AddProjectDialog.vue';
import EditProjectDialog from '@/components/dashboard/EditProjectDialog.vue';
import OrgList from '@/components/dashboard/OrgList.vue';
import OrgFormDialog from '@/components/dashboard/OrgFormDialog.vue';
import ProjectPanel from '@/components/dashboard/ProjectPanel.vue';
import OrgDetailPanel from '@/components/dashboard/OrgDetailPanel.vue';

const orgStore = useOrgStore();
const toast = useToast();
const confirm = useConfirm();

// ─── Analysis composable ────────────────────────────────
const {
    analyzingOrgId,
    objects,
    selectedObject,
    fields,
    loadingObjects,
    loadingFields,
    hasAnalysis,
    checkingAnalysis,
    checkOrgAnalysis,
    doAnalysis,
    stopPolling,
    resetState,
    onSelectObject,
} = useOrgAnalysis();

// ─── State ──────────────────────────────────────────────
const orgFormVisible = ref(false);
const orgFormOrg = ref(null); // null = add mode, object = edit mode
const editProjectVisible = ref(false);

// ─── Computed ───────────────────────────────────────────
const projectOrgs = computed(() => orgStore.projectOrgs);
const selectedProject = computed(() => orgStore.selectedProject);
const selectedOrg = computed(() => orgStore.selectedOrg);

// ─── Lifecycle ──────────────────────────────────────────
onMounted(async () => {
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
watch(selectedOrg, async (org) => {
    resetState();
    if (org) await checkOrgAnalysis(org.id);
});

// ─── Project Actions ────────────────────────────────────
function onCreateProject() {
    orgStore.showAddProjectDialog = true;
}

function onEditProject() {
    editProjectVisible.value = true;
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
</script>

<template>
    <div class="dashboard">
        <div class="dashboard-content">

            <!-- Left Column: Project Selector + Org List -->
            <div class="left-column">
                <ProjectPanel
                    :selectedProject="selectedProject"
                    @create="onCreateProject"
                    @edit="onEditProject"
                />

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

                <div v-else class="dashboard-panel org-panel org-panel-empty">
                    <div class="empty-org-content">
                        <i class="pi pi-arrow-up" style="font-size: 2rem; color: var(--text-color-secondary);"></i>
                        <p>Select a project to get started</p>
                    </div>
                </div>
            </div>

            <!-- Right: Org Detail Panel -->
            <OrgDetailPanel
                v-if="selectedProject && selectedOrg"
                :org="selectedOrg"
                :analyzingOrgId="analyzingOrgId"
                :hasAnalysis="hasAnalysis"
                :checkingAnalysis="checkingAnalysis"
                :objects="objects"
                :selectedObject="selectedObject"
                :fields="fields"
                :loadingObjects="loadingObjects"
                :loadingFields="loadingFields"
                @analyze="doAnalysis"
                @select-object="onSelectObject"
            />

            <div v-else-if="selectedProject" class="dashboard-panel detail-placeholder">
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

.dashboard-panel {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    padding: 1.25rem;
}

.org-panel {
    min-height: 200px;
}

.org-panel-empty {
    min-height: auto;
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

.detail-placeholder {
    min-height: 300px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--text-color-secondary);
}

@media (max-width: 768px) {
    .dashboard-content {
        grid-template-columns: 1fr;
    }
}
</style>
