<template>
    <div class="migration-workspace">
        <div class="workspace-header">
            <h1>Migration Workspace</h1>
            <p class="subtitle">Map objects and fields between Salesforce orgs</p>
        </div>

        <!-- Org Selection -->
        <div class="org-selector-section">
            <div class="org-selector">
                <label>Source Org</label>
                <Dropdown
                    v-model="selectedSourceOrg"
                    :options="orgs"
                    optionLabel="name"
                    placeholder="Select Source Org"
                    @change="onSourceOrgChange"
                    class="w-full"
                />
            </div>
            <div class="arrow-icon">
                <i class="pi pi-arrow-right"></i>
            </div>
            <div class="org-selector">
                <label>Target Org</label>
                <Dropdown
                    v-model="selectedTargetOrg"
                    :options="orgs"
                    optionLabel="name"
                    placeholder="Select Target Org"
                    @change="onTargetOrgChange"
                    class="w-full"
                />
            </div>
        </div>

        <!-- Object Mappings Section -->
        <div v-if="selectedSourceOrg && selectedTargetOrg" class="mappings-section">
            <div class="section-header">
                <h2>Object Mappings</h2>
                <Button
                    label="New Mapping"
                    icon="pi pi-plus"
                    @click="showCreateMappingDialog = true"
                    size="small"
                />
            </div>

            <DataTable
                :value="mappingStore.objectMappings"
                :loading="mappingStore.loading"
                @rowClick="onMappingClick"
                class="mapping-table"
                selectionMode="single"
            >
                <Column field="sourceObject.label" header="Source Object" sortable></Column>
                <Column field="targetObject.label" header="Target Object" sortable></Column>
                <Column field="mappingStatus" header="Status" sortable>
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.mappingStatus" :severity="getStatusSeverity(slotProps.data.mappingStatus)" />
                    </template>
                </Column>
                <Column header="Actions">
                    <template #body="slotProps">
                        <Button
                            icon="pi pi-pencil"
                            severity="info"
                            text
                            @click.stop="editMapping(slotProps.data)"
                            size="small"
                        />
                        <Button
                            icon="pi pi-trash"
                            severity="danger"
                            text
                            @click.stop="confirmDeleteMapping(slotProps.data)"
                            size="small"
                        />
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Create Mapping Dialog -->
        <Dialog
            v-model:visible="showCreateMappingDialog"
            header="Create Object Mapping"
            :modal="true"
            style="width: 500px"
        >
            <div class="dialog-content">
                <div class="field">
                    <label>Source Object</label>
                    <Dropdown
                        v-model="newMapping.sourceObject"
                        :options="sourceObjects"
                        optionLabel="label"
                        placeholder="Select Source Object"
                        filter
                        class="w-full"
                    />
                </div>
                <div class="field">
                    <label>Target Object</label>
                    <Dropdown
                        v-model="newMapping.targetObject"
                        :options="targetObjects"
                        optionLabel="label"
                        placeholder="Select Target Object"
                        filter
                        class="w-full"
                    />
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" icon="pi pi-times" @click="showCreateMappingDialog = false" text />
                <Button label="Create" icon="pi pi-check" @click="createMapping" :loading="mappingStore.loading" />
            </template>
        </Dialog>

        <!-- Delete Confirmation Dialog -->
        <Dialog
            v-model:visible="showDeleteDialog"
            header="Confirm Delete"
            :modal="true"
            style="width: 400px"
        >
            <p>Are you sure you want to delete this mapping? All associated field mappings will also be deleted.</p>
            <template #footer>
                <Button label="Cancel" icon="pi pi-times" @click="showDeleteDialog = false" text />
                <Button label="Delete" icon="pi pi-trash" severity="danger" @click="deleteMapping" :loading="mappingStore.loading" />
            </template>
        </Dialog>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useOrgStore } from '@/stores/orgStore';
import { useMappingStore } from '@/stores/mappingStore';
import { useToast } from 'primevue/usetoast';
import axiosInstance from '@/api/axiosInstance';

const router = useRouter();
const orgStore = useOrgStore();
const mappingStore = useMappingStore();
const toast = useToast();

// State
const selectedSourceOrg = ref(null);
const selectedTargetOrg = ref(null);
const sourceObjects = ref([]);
const targetObjects = ref([]);
const showCreateMappingDialog = ref(false);
const showDeleteDialog = ref(false);
const mappingToDelete = ref(null);
const newMapping = ref({
    sourceObject: null,
    targetObject: null
});

// Computed
const orgs = computed(() => orgStore.orgs || []);

// Methods
async function onSourceOrgChange() {
    if (selectedSourceOrg.value) {
        await loadSourceObjects();
        if (selectedTargetOrg.value) {
            await loadMappings();
        }
    }
}

async function onTargetOrgChange() {
    if (selectedTargetOrg.value) {
        await loadTargetObjects();
        if (selectedSourceOrg.value) {
            await loadMappings();
        }
    }
}

async function loadSourceObjects() {
    try {
        const response = await axiosInstance.get('/api', {
            headers: {
                action: 'get-objects',
                orgId: selectedSourceOrg.value.id
            }
        });
        sourceObjects.value = response.data.data || [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load source objects', life: 3000 });
    }
}

async function loadTargetObjects() {
    try {
        const response = await axiosInstance.get('/api', {
            headers: {
                action: 'get-objects',
                orgId: selectedTargetOrg.value.id
            }
        });
        targetObjects.value = response.data.data || [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load target objects', life: 3000 });
    }
}

async function loadMappings() {
    try {
        await mappingStore.loadMappings(selectedSourceOrg.value.id, selectedTargetOrg.value.id);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load mappings', life: 3000 });
    }
}

async function createMapping() {
    if (!newMapping.value.sourceObject || !newMapping.value.targetObject) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: 'Please select both source and target objects', life: 3000 });
        return;
    }

    try {
        await mappingStore.createMapping(newMapping.value.sourceObject.id, newMapping.value.targetObject.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Mapping created successfully', life: 3000 });
        showCreateMappingDialog.value = false;
        newMapping.value = { sourceObject: null, targetObject: null };
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to create mapping', life: 3000 });
    }
}

function confirmDeleteMapping(mapping) {
    mappingToDelete.value = mapping;
    showDeleteDialog.value = true;
}

async function deleteMapping() {
    try {
        await mappingStore.deleteMapping(mappingToDelete.value.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Mapping deleted successfully', life: 3000 });
        showDeleteDialog.value = false;
        mappingToDelete.value = null;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to delete mapping', life: 3000 });
    }
}

function onMappingClick(event) {
    const mapping = event.data;
    mappingStore.setCurrentMapping(mapping);
    router.push({ name: 'field-mapping', params: { mappingId: mapping.id } });
}

function editMapping(mapping) {
    mappingStore.setCurrentMapping(mapping);
    router.push({ name: 'field-mapping', params: { mappingId: mapping.id } });
}

function getStatusSeverity(status) {
    const severityMap = {
        'draft': 'secondary',
        'validated': 'info',
        'ready': 'success',
        'in_progress': 'warning',
        'complete': 'success',
        'failed': 'danger'
    };
    return severityMap[status] || 'secondary';
}

// Lifecycle
onMounted(async () => {
    await orgStore.loadOrgs();
    mappingStore.clearMappings();
});
</script>

<style scoped>
.migration-workspace {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
}

.workspace-header {
    margin-bottom: 2rem;
}

.workspace-header h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
}

.subtitle {
    color: var(--text-color-secondary);
    font-size: 1rem;
}

.org-selector-section {
    display: flex;
    align-items: center;
    gap: 2rem;
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--surface-card);
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.org-selector {
    flex: 1;
}

.org-selector label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
}

.arrow-icon {
    font-size: 1.5rem;
    color: var(--primary-color);
    margin-top: 1.5rem;
}

.mappings-section {
    margin-top: 2rem;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.section-header h2 {
    font-size: 1.5rem;
}

.mapping-table {
    background: var(--surface-card);
    border-radius: 8px;
}

.dialog-content {
    padding: 1rem 0;
}

.field {
    margin-bottom: 1.5rem;
}

.field label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
}
</style>
