<template>
    <div class="field-mapping-workspace">
        <div class="workspace-header">
            <Button
                icon="pi pi-arrow-left"
                label="Back to Mappings"
                @click="router.push({ name: 'migration-workspace' })"
                text
            />
            <div v-if="mapping" class="mapping-info">
                <h1>Field Mapping</h1>
                <p class="mapping-title">
                    {{ mapping.sourceObject?.label }} → {{ mapping.targetObject?.label }}
                </p>
            </div>
        </div>

        <div v-if="mapping" class="mapping-controls">
            <div class="status-section">
                <Tag :value="mapping.mappingStatus" :severity="getStatusSeverity(mapping.mappingStatus)" />
            </div>
            <div class="action-buttons">
                <Button
                    label="Add Field Mapping"
                    icon="pi pi-plus"
                    @click="showAddMappingDialog = true"
                    size="small"
                />
            </div>
        </div>

        <!-- Field Mappings Table -->
        <DataTable
            :value="mappingStore.fieldMappings"
            :loading="mappingStore.loading"
            class="field-mapping-table"
        >
            <Column field="sourceField.label" header="Source Field">
                <template #body="slotProps">
                    <div v-if="slotProps.data.sourceField">
                        <div class="field-label">{{ slotProps.data.sourceField.label }}</div>
                        <div class="field-name">{{ slotProps.data.sourceField.name }}</div>
                        <div class="field-type">{{ slotProps.data.sourceField.type }}</div>
                    </div>
                    <div v-else class="no-source">
                        <i>{{ slotProps.data.mappingType === 'constant' ? 'Constant Value' : 'No Source' }}</i>
                    </div>
                </template>
            </Column>
            <Column field="mappingType" header="Mapping Type">
                <template #body="slotProps">
                    <Tag :value="slotProps.data.mappingType" :severity="getMappingTypeSeverity(slotProps.data.mappingType)" />
                </template>
            </Column>
            <Column field="targetField.label" header="Target Field">
                <template #body="slotProps">
                    <div class="field-label">{{ slotProps.data.targetField.label }}</div>
                    <div class="field-name">{{ slotProps.data.targetField.name }}</div>
                    <div class="field-type">{{ slotProps.data.targetField.type }}</div>
                </template>
            </Column>
            <Column field="transformationRule" header="Transformation">
                <template #body="slotProps">
                    <span v-if="slotProps.data.mappingType === 'expression'">
                        {{ slotProps.data.transformationRule || 'N/A' }}
                    </span>
                    <span v-else-if="slotProps.data.mappingType === 'constant'">
                        {{ slotProps.data.constantValue }}
                    </span>
                    <span v-else>-</span>
                </template>
            </Column>
            <Column header="Actions">
                <template #body="slotProps">
                    <Button
                        icon="pi pi-pencil"
                        severity="info"
                        text
                        @click="editFieldMapping(slotProps.data)"
                        size="small"
                    />
                    <Button
                        icon="pi pi-trash"
                        severity="danger"
                        text
                        @click="confirmDeleteFieldMapping(slotProps.data)"
                        size="small"
                    />
                </template>
            </Column>
        </DataTable>

        <!-- Add Field Mapping Dialog -->
        <Dialog
            v-model:visible="showAddMappingDialog"
            header="Add Field Mapping"
            :modal="true"
            style="width: 600px"
        >
            <div class="dialog-content">
                <div class="field">
                    <label>Mapping Type</label>
                    <Dropdown
                        v-model="newFieldMapping.mappingType"
                        :options="mappingTypes"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select Mapping Type"
                        class="w-full"
                        @change="onMappingTypeChange"
                    />
                </div>

                <div v-if="newFieldMapping.mappingType !== 'constant'" class="field">
                    <label>Source Field</label>
                    <Dropdown
                        v-model="newFieldMapping.sourceField"
                        :options="sourceFields"
                        optionLabel="label"
                        placeholder="Select Source Field"
                        filter
                        class="w-full"
                    >
                        <template #option="slotProps">
                            <div>
                                <div>{{ slotProps.option.label }}</div>
                                <small>{{ slotProps.option.name }} ({{ slotProps.option.type }})</small>
                            </div>
                        </template>
                    </Dropdown>
                </div>

                <div class="field">
                    <label>Target Field</label>
                    <Dropdown
                        v-model="newFieldMapping.targetField"
                        :options="targetFields"
                        optionLabel="label"
                        placeholder="Select Target Field"
                        filter
                        class="w-full"
                    >
                        <template #option="slotProps">
                            <div>
                                <div>{{ slotProps.option.label }}</div>
                                <small>{{ slotProps.option.name }} ({{ slotProps.option.type }})</small>
                            </div>
                        </template>
                    </Dropdown>
                </div>

                <div v-if="newFieldMapping.mappingType === 'expression'" class="field">
                    <label>Transformation Rule</label>
                    <Textarea
                        v-model="newFieldMapping.transformationRule"
                        rows="3"
                        placeholder="Enter transformation rule"
                        class="w-full"
                    />
                </div>

                <div v-if="newFieldMapping.mappingType === 'constant'" class="field">
                    <label>Constant Value</label>
                    <InputText
                        v-model="newFieldMapping.constantValue"
                        placeholder="Enter constant value"
                        class="w-full"
                    />
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" icon="pi pi-times" @click="closeAddDialog" text />
                <Button label="Create" icon="pi pi-check" @click="createFieldMapping" :loading="mappingStore.loading" />
            </template>
        </Dialog>

        <!-- Delete Confirmation Dialog -->
        <Dialog
            v-model:visible="showDeleteDialog"
            header="Confirm Delete"
            :modal="true"
            style="width: 400px"
        >
            <p>Are you sure you want to delete this field mapping?</p>
            <template #footer>
                <Button label="Cancel" icon="pi pi-times" @click="showDeleteDialog = false" text />
                <Button label="Delete" icon="pi pi-trash" severity="danger" @click="deleteFieldMapping" :loading="mappingStore.loading" />
            </template>
        </Dialog>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMappingStore } from '@/stores/mappingStore';
import { useToast } from 'primevue/usetoast';
import axiosInstance from '@/api/axiosInstance';

const route = useRoute();
const router = useRouter();
const mappingStore = useMappingStore();
const toast = useToast();

// State
const mapping = ref(null);
const sourceFields = ref([]);
const targetFields = ref([]);
const showAddMappingDialog = ref(false);
const showDeleteDialog = ref(false);
const fieldMappingToDelete = ref(null);
const newFieldMapping = ref({
    mappingType: 'as-is',
    sourceField: null,
    targetField: null,
    transformationRule: null,
    constantValue: null
});

const mappingTypes = [
    { label: 'As-Is (Direct Copy)', value: 'as-is' },
    { label: 'Expression/Transform', value: 'expression' },
    { label: 'Constant Value', value: 'constant' }
];

// Methods
async function loadMapping() {
    const mappingId = route.params.mappingId;

    // Check if mapping is in store
    mapping.value = mappingStore.getMappingById.value(mappingId);

    if (!mapping.value) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Mapping not found', life: 3000 });
        router.push({ name: 'migration-workspace' });
        return;
    }

    // Load field mappings
    await mappingStore.loadFieldMappings(mappingId);

    // Load source and target fields
    await loadSourceFields();
    await loadTargetFields();
}

async function loadSourceFields() {
    try {
        const response = await axiosInstance.get('/api', {
            headers: {
                action: 'get-fields',
                objectId: mapping.value.sourceObjectId
            }
        });
        sourceFields.value = response.data.data || [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load source fields', life: 3000 });
    }
}

async function loadTargetFields() {
    try {
        const response = await axiosInstance.get('/api', {
            headers: {
                action: 'get-fields',
                objectId: mapping.value.targetObjectId
            }
        });
        targetFields.value = response.data.data || [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load target fields', life: 3000 });
    }
}


function onMappingTypeChange() {
    // Clear fields based on mapping type
    if (newFieldMapping.value.mappingType === 'constant') {
        newFieldMapping.value.sourceField = null;
        newFieldMapping.value.transformationRule = null;
    } else if (newFieldMapping.value.mappingType === 'as-is') {
        newFieldMapping.value.transformationRule = null;
        newFieldMapping.value.constantValue = null;
    } else {
        newFieldMapping.value.constantValue = null;
    }
}

async function createFieldMapping() {
    const data = {
        objectMappingId: mapping.value.id,
        targetFieldId: newFieldMapping.value.targetField?.id,
        mappingType: newFieldMapping.value.mappingType
    };

    if (newFieldMapping.value.mappingType !== 'constant') {
        data.sourceFieldId = newFieldMapping.value.sourceField?.id;
    }

    if (newFieldMapping.value.mappingType === 'expression') {
        data.transformationRule = newFieldMapping.value.transformationRule;
    }

    if (newFieldMapping.value.mappingType === 'constant') {
        data.constantValue = newFieldMapping.value.constantValue;
    }

    try {
        await mappingStore.createFieldMapping(data);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Field mapping created', life: 3000 });
        closeAddDialog();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to create field mapping', life: 3000 });
    }
}

function closeAddDialog() {
    showAddMappingDialog.value = false;
    newFieldMapping.value = {
        mappingType: 'as-is',
        sourceField: null,
        targetField: null,
        transformationRule: null,
        constantValue: null
    };
}

function editFieldMapping(fieldMapping) {
    // TODO: Implement edit functionality
    toast.add({ severity: 'info', summary: 'Info', detail: 'Edit functionality coming soon', life: 3000 });
}

function confirmDeleteFieldMapping(fieldMapping) {
    fieldMappingToDelete.value = fieldMapping;
    showDeleteDialog.value = true;
}

async function deleteFieldMapping() {
    try {
        await mappingStore.deleteFieldMapping(fieldMappingToDelete.value.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Field mapping deleted', life: 3000 });
        showDeleteDialog.value = false;
        fieldMappingToDelete.value = null;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to delete field mapping', life: 3000 });
    }
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

function getMappingTypeSeverity(type) {
    const severityMap = {
        'as-is': 'success',
        'expression': 'warning',
        'constant': 'info'
    };
    return severityMap[type] || 'secondary';
}

// Lifecycle
onMounted(async () => {
    await loadMapping();
});
</script>

<style scoped>
.field-mapping-workspace {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
}

.workspace-header {
    margin-bottom: 2rem;
}

.mapping-info h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
}

.mapping-title {
    color: var(--text-color-secondary);
    font-size: 1.2rem;
    font-weight: 600;
}

.mapping-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    background: var(--surface-card);
    border-radius: 8px;
    margin-bottom: 2rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.status-section {
    display: flex;
    align-items: center;
}

.action-buttons {
    display: flex;
    gap: 1rem;
}

.field-mapping-table {
    background: var(--surface-card);
    border-radius: 8px;
}

.field-label {
    font-weight: 600;
    margin-bottom: 0.25rem;
}

.field-name {
    font-family: monospace;
    font-size: 0.9rem;
    color: var(--text-color-secondary);
}

.field-type {
    font-size: 0.85rem;
    color: var(--text-color-secondary);
    font-style: italic;
}

.no-source {
    color: var(--text-color-secondary);
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
