<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useOrgStore } from '@/stores/orgStore';
import { useMetadataStore } from '@/stores/metadataStore';
import { useMappingStore } from '@/stores/mappingStore';

import Card from 'primevue/card';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Badge from 'primevue/badge';

const route = useRoute();
const orgStore = useOrgStore();
const metadataStore = useMetadataStore();
const mappingStore = useMappingStore();

// State
const projectId = ref(null);
const currentProject = computed(() => {
    return orgStore.projects.find(p => p.id === projectId.value);
});

const availableOrgs = computed(() => {
    if (!projectId.value) return [];
    return orgStore.orgs.filter(org => org.projectId === projectId.value);
});

const sourceOrgOptions = computed(() => {
    return availableOrgs.value.map(org => ({
        label: org.name,
        value: org
    }));
});

const targetOrgOptions = computed(() => {
    return availableOrgs.value.map(org => ({
        label: org.name,
        value: org
    }));
});

const sourceOrgSelection = computed({
    get: () => metadataStore.sourceOrg,
    set: (org) => metadataStore.setSourceOrg(org)
});

const targetOrgSelection = computed({
    get: () => metadataStore.targetOrg,
    set: (org) => metadataStore.setTargetOrg(org)
});

const canAnalyze = computed(() => {
    return {
        source: sourceOrgSelection.value && !metadataStore.loadingSourceObjects,
        target: targetOrgSelection.value && !metadataStore.loadingTargetObjects
    };
});

const mappingSummary = computed(() => {
    const stats = mappingStore.mappingStatistics;
    return {
        objectMappings: stats.totalObjectMappings,
        fieldMappings: stats.totalFieldMappings,
        activeMappings: mappingStore.activeObjectMappings.length
    };
});

// Methods
async function analyzeSourceOrg() {
    if (!sourceOrgSelection.value) return;

    try {
        await metadataStore.analyzeSourceOrg();
        await metadataStore.loadSourceObjects();
    } catch (error) {
        console.error('Failed to analyze source org:', error);
    }
}

async function analyzeTargetOrg() {
    if (!targetOrgSelection.value) return;

    try {
        await metadataStore.analyzeTargetOrg();
        await metadataStore.loadTargetObjects();
    } catch (error) {
        console.error('Failed to analyze target org:', error);
    }
}

function selectSourceObject(object) {
    metadataStore.selectSourceObject(object);
}

function selectTargetObject(object) {
    metadataStore.selectTargetObject(object);
}

// Lifecycle
onMounted(async () => {
    // Get project ID from route params or selected project
    projectId.value = route.params.projectId || orgStore.selectedProject?.id;

    if (!projectId.value) {
        console.error('No project selected');
        return;
    }

    // Load projects and orgs if not already loaded
    if (orgStore.projects.length === 0) {
        await orgStore.loadProjects();
    }

    // Load existing mappings for this project
    if (projectId.value) {
        try {
            await mappingStore.loadMappings(projectId.value);
        } catch (error) {
            console.error('Failed to load mappings:', error);
            // Non-critical error - continue without mappings
        }
    }
});

// Watch for org selection changes
watch(sourceOrgSelection, async (newOrg, oldOrg) => {
    if (newOrg && newOrg.id && newOrg.id !== oldOrg?.id) {
        try {
            // Load objects if org has been analyzed
            await metadataStore.loadSourceObjects();
        } catch (error) {
            console.error('Failed to load source objects:', error);
            // Don't throw - just log the error. Empty metadata is OK.
        }
    }
});

watch(targetOrgSelection, async (newOrg, oldOrg) => {
    if (newOrg && newOrg.id && newOrg.id !== oldOrg?.id) {
        try {
            // Load objects if org has been analyzed
            await metadataStore.loadTargetObjects();
        } catch (error) {
            console.error('Failed to load target objects:', error);
            // Don't throw - just log the error. Empty metadata is OK.
        }
    }
});
</script>

<template>
    <div class="migration-workspace">
        <!-- Header -->
        <div class="workspace-header">
            <div class="header-content">
                <h1>Migration Workspace</h1>
                <p v-if="currentProject" class="project-name">{{ currentProject.name }}</p>
            </div>
            <div v-if="metadataStore.readyForMapping" class="mapping-summary">
                <Badge :value="mappingSummary.objectMappings" severity="info" class="mr-2">
                    <template #default>
                        <span class="badge-label">{{ mappingSummary.objectMappings }} Object Mappings</span>
                    </template>
                </Badge>
                <Badge :value="mappingSummary.fieldMappings" severity="success">
                    <template #default>
                        <span class="badge-label">{{ mappingSummary.fieldMappings }} Field Mappings</span>
                    </template>
                </Badge>
            </div>
        </div>

        <!-- Main Content -->
        <div class="workspace-content">
            <!-- Source Org Panel -->
            <Card class="org-panel source-panel">
                <template #title>
                    <div class="panel-title">
                        <i class="pi pi-upload mr-2"></i>
                        Source Org
                    </div>
                </template>
                <template #content>
                    <!-- Org Selection -->
                    <div class="org-selection">
                        <label for="source-org">Select Source Org</label>
                        <Select
                            id="source-org"
                            v-model="sourceOrgSelection"
                            :options="sourceOrgOptions"
                            optionLabel="label"
                            placeholder="Choose source org"
                            class="w-full"
                        />
                        <Button
                            label="Analyze Org"
                            icon="pi pi-search"
                            :disabled="!canAnalyze.source"
                            :loading="metadataStore.loadingSourceObjects"
                            @click="analyzeSourceOrg"
                            class="mt-3 w-full"
                            severity="secondary"
                        />
                    </div>

                    <!-- Object List -->
                    <div v-if="metadataStore.sourceAnalyzed" class="object-list mt-4">
                        <div class="list-header">
                            <h3>Objects ({{ metadataStore.sourceObjects.length }})</h3>
                            <div class="list-filters">
                                <small class="text-muted">
                                    {{ metadataStore.sourceCustomObjects.length }} custom,
                                    {{ metadataStore.sourceStandardObjects.length }} standard
                                </small>
                            </div>
                        </div>

                        <DataTable
                            :value="metadataStore.sourceObjects"
                            selectionMode="single"
                            :metaKeySelection="false"
                            @row-select="selectSourceObject($event.data)"
                            scrollable
                            scrollHeight="400px"
                            class="compact-table"
                        >
                            <Column field="objectLabel" header="Object">
                                <template #body="slotProps">
                                    <div class="object-name">
                                        <i v-if="slotProps.data.isCustom" class="pi pi-star-fill text-primary mr-2"></i>
                                        <span>{{ slotProps.data.objectLabel }}</span>
                                    </div>
                                </template>
                            </Column>
                            <Column field="objectName" header="API Name" class="text-xs"></Column>
                            <Column field="recordCount" header="Records">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.recordCount || 0" severity="secondary"></Badge>
                                </template>
                            </Column>
                        </DataTable>
                    </div>

                    <!-- Empty State -->
                    <div v-else-if="sourceOrgSelection" class="empty-state">
                        <i class="pi pi-inbox empty-icon"></i>
                        <p>Click "Analyze Org" to load metadata</p>
                    </div>

                    <!-- Loading State -->
                    <div v-if="metadataStore.loadingSourceObjects" class="loading-state">
                        <ProgressSpinner style="width: 50px; height: 50px" />
                        <p>Analyzing source org...</p>
                    </div>

                    <!-- Error State -->
                    <Message v-if="metadataStore.sourceError" severity="error" class="mt-3">
                        {{ metadataStore.sourceError }}
                    </Message>
                </template>
            </Card>

            <!-- Mappings Panel -->
            <Card class="mappings-panel">
                <template #title>
                    <div class="panel-title">
                        <i class="pi pi-arrows-h mr-2"></i>
                        Mappings
                    </div>
                </template>
                <template #content>
                    <div v-if="!metadataStore.readyForMapping" class="empty-state">
                        <i class="pi pi-info-circle empty-icon"></i>
                        <p>Select and analyze both source and target orgs to create mappings</p>
                    </div>

                    <div v-else class="mappings-content">
                        <Button
                            label="Create Object Mapping"
                            icon="pi pi-plus"
                            class="w-full mb-3"
                            severity="info"
                        />

                        <!-- Mapping List -->
                        <div v-if="mappingStore.objectMappings.length > 0" class="mapping-list">
                            <DataTable
                                :value="mappingStore.objectMappings"
                                class="compact-table"
                            >
                                <Column header="Source → Target">
                                    <template #body="slotProps">
                                        <div class="mapping-row">
                                            <span class="source-obj">{{ slotProps.data.sourceObjectName }}</span>
                                            <i class="pi pi-arrow-right mx-2"></i>
                                            <span class="target-obj">{{ slotProps.data.targetObjectName }}</span>
                                        </div>
                                    </template>
                                </Column>
                                <Column header="Fields">
                                    <template #body="slotProps">
                                        <Badge :value="slotProps.data.fieldMappingsCount || 0" severity="success"></Badge>
                                    </template>
                                </Column>
                            </DataTable>
                        </div>

                        <div v-else class="empty-mappings">
                            <p class="text-muted">No mappings created yet</p>
                        </div>
                    </div>

                    <!-- Loading State -->
                    <div v-if="mappingStore.loadingMappings" class="loading-state">
                        <ProgressSpinner style="width: 50px; height: 50px" />
                        <p>Loading mappings...</p>
                    </div>
                </template>
            </Card>

            <!-- Target Org Panel -->
            <Card class="org-panel target-panel">
                <template #title>
                    <div class="panel-title">
                        <i class="pi pi-download mr-2"></i>
                        Target Org
                    </div>
                </template>
                <template #content>
                    <!-- Org Selection -->
                    <div class="org-selection">
                        <label for="target-org">Select Target Org</label>
                        <Select
                            id="target-org"
                            v-model="targetOrgSelection"
                            :options="targetOrgOptions"
                            optionLabel="label"
                            placeholder="Choose target org"
                            class="w-full"
                        />
                        <Button
                            label="Analyze Org"
                            icon="pi pi-search"
                            :disabled="!canAnalyze.target"
                            :loading="metadataStore.loadingTargetObjects"
                            @click="analyzeTargetOrg"
                            class="mt-3 w-full"
                            severity="secondary"
                        />
                    </div>

                    <!-- Object List -->
                    <div v-if="metadataStore.targetAnalyzed" class="object-list mt-4">
                        <div class="list-header">
                            <h3>Objects ({{ metadataStore.targetObjects.length }})</h3>
                            <div class="list-filters">
                                <small class="text-muted">
                                    {{ metadataStore.targetCustomObjects.length }} custom,
                                    {{ metadataStore.targetStandardObjects.length }} standard
                                </small>
                            </div>
                        </div>

                        <DataTable
                            :value="metadataStore.targetObjects"
                            selectionMode="single"
                            :metaKeySelection="false"
                            @row-select="selectTargetObject($event.data)"
                            scrollable
                            scrollHeight="400px"
                            class="compact-table"
                        >
                            <Column field="objectLabel" header="Object">
                                <template #body="slotProps">
                                    <div class="object-name">
                                        <i v-if="slotProps.data.isCustom" class="pi pi-star-fill text-primary mr-2"></i>
                                        <span>{{ slotProps.data.objectLabel }}</span>
                                    </div>
                                </template>
                            </Column>
                            <Column field="objectName" header="API Name" class="text-xs"></Column>
                            <Column field="recordCount" header="Records">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.recordCount || 0" severity="secondary"></Badge>
                                </template>
                            </Column>
                        </DataTable>
                    </div>

                    <!-- Empty State -->
                    <div v-else-if="targetOrgSelection" class="empty-state">
                        <i class="pi pi-inbox empty-icon"></i>
                        <p>Click "Analyze Org" to load metadata</p>
                    </div>

                    <!-- Loading State -->
                    <div v-if="metadataStore.loadingTargetObjects" class="loading-state">
                        <ProgressSpinner style="width: 50px; height: 50px" />
                        <p>Analyzing target org...</p>
                    </div>

                    <!-- Error State -->
                    <Message v-if="metadataStore.targetError" severity="error" class="mt-3">
                        {{ metadataStore.targetError }}
                    </Message>
                </template>
            </Card>
        </div>
    </div>
</template>

<style scoped lang="scss">
.migration-workspace {
    padding: 1.5rem;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.workspace-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--surface-border);

    .header-content {
        h1 {
            margin: 0 0 0.25rem 0;
            font-size: 1.75rem;
            font-weight: 600;
        }

        .project-name {
            margin: 0;
            color: var(--text-color-secondary);
            font-size: 0.875rem;
        }
    }

    .mapping-summary {
        display: flex;
        gap: 0.75rem;
        align-items: center;

        .badge-label {
            margin-left: 0.5rem;
        }
    }
}

.workspace-content {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1.5rem;
    flex: 1;
    min-height: 0;
}

.org-panel,
.mappings-panel {
    display: flex;
    flex-direction: column;
    height: 100%;

    :deep(.p-card-content) {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
}

.panel-title {
    display: flex;
    align-items: center;
    font-size: 1.1rem;
    font-weight: 600;
}

.org-selection {
    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        font-size: 0.875rem;
    }
}

.object-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;

        h3 {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
        }
    }

    .compact-table {
        flex: 1;

        :deep(.p-datatable-tbody) {
            font-size: 0.875rem;
        }
    }
}

.object-name {
    display: flex;
    align-items: center;
}

.empty-state,
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--text-color-secondary);

    .empty-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.3;
    }

    p {
        margin: 0.5rem 0 0 0;
        font-size: 0.875rem;
    }
}

.mappings-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.mapping-list {
    flex: 1;
    overflow: auto;

    .mapping-row {
        display: flex;
        align-items: center;
        font-size: 0.875rem;

        .source-obj {
            font-weight: 500;
        }

        .target-obj {
            color: var(--primary-color);
            font-weight: 500;
        }
    }
}

.empty-mappings {
    padding: 2rem;
    text-align: center;
}

// Responsive
@media (max-width: 1400px) {
    .workspace-content {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: auto auto;

        .mappings-panel {
            grid-column: 1 / -1;
        }
    }
}

@media (max-width: 768px) {
    .workspace-content {
        grid-template-columns: 1fr;
    }

    .workspace-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
    }
}
</style>
