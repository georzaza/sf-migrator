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

        <div v-if="mapping" class="mapper-layout">
            <div class="mapper-panel side-panel">
                <h2>Source</h2>
                <div class="panel-group">
                    <label>Source Object</label>
                    <Dropdown
                        v-model="selectedSourceObject"
                        :options="sourceObjects"
                        optionLabel="label"
                        placeholder="Search and select source object"
                        filter
                        class="w-full"
                    />
                    <div class="details-card" v-if="selectedSourceObject">
                        <div class="details-title">Object Details</div>
                        <div><strong>Label:</strong> {{ selectedSourceObject.label }}</div>
                        <div><strong>API Name:</strong> {{ selectedSourceObject.name }}</div>
                        <div><strong>Custom:</strong> {{ selectedSourceObject.isCustom ? 'Yes' : 'No' }}</div>
                    </div>
                </div>

                <div class="panel-group">
                    <label>Source Field</label>
                    <Dropdown
                        v-model="selectedSourceField"
                        :options="sourceFields"
                        optionLabel="label"
                        placeholder="Search and select source field"
                        filter
                        class="w-full"
                        :disabled="!selectedSourceObject"
                    >
                        <template #option="slotProps">
                            <div>
                                <div>{{ slotProps.option.label }}</div>
                                <small>{{ slotProps.option.name }} ({{ slotProps.option.type }})</small>
                            </div>
                        </template>
                    </Dropdown>
                    <div class="details-card" v-if="selectedSourceField">
                        <div class="details-title">Field Details</div>
                        <div><strong>Label:</strong> {{ selectedSourceField.label }}</div>
                        <div><strong>API Name:</strong> {{ selectedSourceField.name }}</div>
                        <div><strong>Type:</strong> {{ selectedSourceField.type }}</div>
                    </div>
                </div>
            </div>

            <div class="mapper-panel center-panel">
                <h2>Mapping Options</h2>
                <div class="status-section">
                    <span>Object Pair:</span>
                    <Tag :value="`${mapping.sourceObject?.label || 'Source'} → ${mapping.targetObject?.label || 'Target'}`" severity="info" />
                </div>

                <div class="panel-group">
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

                <div v-if="newFieldMapping.mappingType === 'expression'" class="panel-group">
                    <label>Transformation Rule</label>
                    <Textarea
                        v-model="newFieldMapping.transformationRule"
                        rows="4"
                        placeholder="Use {Object.Field}, {Object.Field1 || Object.Field2}, {SUBSTR(Object.Field, 2, 5)}"
                        class="w-full"
                    />
                </div>

                <div v-if="newFieldMapping.mappingType === 'constant'" class="panel-group">
                    <label>Constant Value</label>
                    <InputText
                        v-model="newFieldMapping.constantValue"
                        placeholder="Enter constant value"
                        class="w-full"
                    />
                </div>

                <div class="mapping-preview">
                    <div class="preview-item">{{ selectedSourceField?.label || 'Select source field' }}</div>
                    <i class="pi pi-arrow-right"></i>
                    <div class="preview-item">{{ selectedTargetField?.label || 'Select target field' }}</div>
                </div>

                <Button
                    label="Create Field Mapping"
                    icon="pi pi-plus"
                    @click="createFieldMapping"
                    :loading="mappingStore.loading"
                    class="w-full"
                />
            </div>

            <div class="mapper-panel side-panel">
                <h2>Target</h2>
                <div class="panel-group">
                    <label>Target Object</label>
                    <Dropdown
                        v-model="selectedTargetObject"
                        :options="targetObjects"
                        optionLabel="label"
                        placeholder="Search and select target object"
                        filter
                        class="w-full"
                    />
                    <div class="details-card" v-if="selectedTargetObject">
                        <div class="details-title">Object Details</div>
                        <div><strong>Label:</strong> {{ selectedTargetObject.label }}</div>
                        <div><strong>API Name:</strong> {{ selectedTargetObject.name }}</div>
                        <div><strong>Custom:</strong> {{ selectedTargetObject.isCustom ? 'Yes' : 'No' }}</div>
                    </div>
                </div>

                <div class="panel-group">
                    <label>Target Field</label>
                    <Dropdown
                        v-model="selectedTargetField"
                        :options="targetFields"
                        optionLabel="label"
                        placeholder="Search and select target field"
                        filter
                        class="w-full"
                        :disabled="!selectedTargetObject"
                    >
                        <template #option="slotProps">
                            <div>
                                <div>{{ slotProps.option.label }}</div>
                                <small>{{ slotProps.option.name }} ({{ slotProps.option.type }})</small>
                            </div>
                        </template>
                    </Dropdown>
                    <div class="details-card" v-if="selectedTargetField">
                        <div class="details-title">Field Details</div>
                        <div><strong>Label:</strong> {{ selectedTargetField.label }}</div>
                        <div><strong>API Name:</strong> {{ selectedTargetField.name }}</div>
                        <div><strong>Type:</strong> {{ selectedTargetField.type }}</div>
                    </div>
                </div>
            </div>
        </div>

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
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMappingStore } from '@/stores/mappingStore';
import { useToast } from 'primevue/usetoast';
import axiosInstance from '@/api/axiosInstance';

const route = useRoute();
const router = useRouter();
const mappingStore = useMappingStore();
const toast = useToast();

const mapping = ref(null);
const sourceObjects = ref([]);
const targetObjects = ref([]);
const sourceFields = ref([]);
const targetFields = ref([]);
const selectedSourceObject = ref(null);
const selectedTargetObject = ref(null);
const selectedSourceField = ref(null);
const selectedTargetField = ref(null);
const showDeleteDialog = ref(false);
const fieldMappingToDelete = ref(null);
const newFieldMapping = ref({
    mappingType: 'as-is',
    transformationRule: null,
    constantValue: null
});

const mappingTypes = [
    { label: 'As-Is (Direct Copy)', value: 'as-is' },
    { label: 'Expression/Transform', value: 'expression' },
    { label: 'Constant Value', value: 'constant' }
];

async function loadMapping() {
    const mappingId = route.params.mappingId;
    mapping.value = mappingStore.getMappingById.value(mappingId);

    if (!mapping.value) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Mapping not found', life: 3000 });
        router.push({ name: 'migration-workspace' });
        return;
    }

    selectedSourceObject.value = mapping.value.sourceObject || null;
    selectedTargetObject.value = mapping.value.targetObject || null;

    await loadObjectsForMappingOrgs();
    await mappingStore.loadFieldMappings(mappingId);

    if (selectedSourceObject.value?.id) {
        await loadSourceFields(selectedSourceObject.value.id);
    }
    if (selectedTargetObject.value?.id) {
        await loadTargetFields(selectedTargetObject.value.id);
    }
}

async function loadObjectsForMappingOrgs() {
    try {
        const sourceOrgId = mapping.value?.sourceObject?.sfOrgId;
        const targetOrgId = mapping.value?.targetObject?.sfOrgId;

        if (sourceOrgId) {
            const sourceResponse = await axiosInstance.get('/api', {
                headers: {
                    action: 'get-objects',
                    orgId: sourceOrgId
                }
            });
            sourceObjects.value = sourceResponse.data.data || [];
            if (selectedSourceObject.value?.id) {
                selectedSourceObject.value = sourceObjects.value.find(obj => obj.id === selectedSourceObject.value.id) || selectedSourceObject.value;
            }
        }

        if (targetOrgId) {
            const targetResponse = await axiosInstance.get('/api', {
                headers: {
                    action: 'get-objects',
                    orgId: targetOrgId
                }
            });
            targetObjects.value = targetResponse.data.data || [];
            if (selectedTargetObject.value?.id) {
                selectedTargetObject.value = targetObjects.value.find(obj => obj.id === selectedTargetObject.value.id) || selectedTargetObject.value;
            }
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load mapping objects', life: 3000 });
    }
}

async function loadSourceFields(objectId) {
    try {
        const response = await axiosInstance.get('/api', {
            headers: {
                action: 'get-fields',
                objectId
            }
        });
        sourceFields.value = response.data.data || [];
        selectedSourceField.value = null;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load source fields', life: 3000 });
    }
}

async function loadTargetFields(objectId) {
    try {
        const response = await axiosInstance.get('/api', {
            headers: {
                action: 'get-fields',
                objectId
            }
        });
        targetFields.value = response.data.data || [];
        selectedTargetField.value = null;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load target fields', life: 3000 });
    }
}

function onMappingTypeChange() {
    if (newFieldMapping.value.mappingType === 'constant') {
        selectedSourceField.value = null;
        newFieldMapping.value.transformationRule = null;
    } else if (newFieldMapping.value.mappingType === 'as-is') {
        newFieldMapping.value.transformationRule = null;
        newFieldMapping.value.constantValue = null;
    } else {
        newFieldMapping.value.constantValue = null;
    }
}

async function createFieldMapping() {
    if (!selectedTargetField.value) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: 'Please select a target field', life: 3000 });
        return;
    }

    if (newFieldMapping.value.mappingType === 'as-is' && !selectedSourceField.value) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: 'Please select a source field', life: 3000 });
        return;
    }

    if (newFieldMapping.value.mappingType === 'expression' && !newFieldMapping.value.transformationRule) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: 'Please provide a transformation rule', life: 3000 });
        return;
    }

    if (!selectedSourceObject.value || !selectedTargetObject.value) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: 'Please select source and target objects', life: 3000 });
        return;
    }

    if (
        mapping.value.sourceObjectId !== selectedSourceObject.value.id
        || mapping.value.targetObjectId !== selectedTargetObject.value.id
    ) {
        try {
            const selectedMapping = await mappingStore.createMapping(
                selectedSourceObject.value.id,
                selectedTargetObject.value.id
            );
            mapping.value = selectedMapping;
            mappingStore.setCurrentMapping(selectedMapping);
            await router.replace({ name: 'field-mapping', params: { mappingId: selectedMapping.id } });
            await mappingStore.loadFieldMappings(selectedMapping.id);
        } catch (error) {
            toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to use selected object mapping', life: 3000 });
            return;
        }
    }

    const data = {
        sourceObjectId: selectedSourceObject.value.id,
        targetObjectId: selectedTargetObject.value.id,
        targetFieldId: selectedTargetField.value?.id,
        mappingType: newFieldMapping.value.mappingType
    };

    if (newFieldMapping.value.mappingType === 'as-is') {
        data.sourceFieldId = selectedSourceField.value?.id;
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
        resetFieldSelection();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to create field mapping', life: 3000 });
    }
}

function resetFieldSelection() {
    if (newFieldMapping.value.mappingType !== 'constant') {
        selectedSourceField.value = null;
    }
    selectedTargetField.value = null;
    newFieldMapping.value = {
        mappingType: 'as-is',
        transformationRule: null,
        constantValue: null
    };
}

function editFieldMapping() {
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

function getMappingTypeSeverity(type) {
    const severityMap = {
        'as-is': 'success',
        expression: 'warning',
        constant: 'info'
    };
    return severityMap[type] || 'secondary';
}

onMounted(async () => {
    await loadMapping();
});

watch(() => selectedSourceObject.value?.id, async (newValue, oldValue) => {
    if (!newValue || newValue === oldValue) {
        return;
    }
    await loadSourceFields(newValue);
});

watch(() => selectedTargetObject.value?.id, async (newValue, oldValue) => {
    if (!newValue || newValue === oldValue) {
        return;
    }
    await loadTargetFields(newValue);
});
</script>

<style scoped>
.field-mapping-workspace {
    padding: 2rem;
    max-width: 1600px;
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

.mapper-layout {
    display: grid;
    grid-template-columns: 1fr 0.85fr 1fr;
    gap: 1rem;
    margin-bottom: 2rem;
}

.mapper-panel {
    background: var(--surface-card);
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.mapper-panel h2 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
}

.panel-group {
    margin-bottom: 1rem;
}

.panel-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
}

.details-card {
    margin-top: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    background: var(--surface-ground);
    font-size: 0.9rem;
    line-height: 1.5;
}

.details-title {
    font-weight: 700;
    margin-bottom: 0.35rem;
}

.center-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.status-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--surface-ground);
    border-radius: 6px;
}

.mapping-preview {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--surface-ground);
    border-radius: 6px;
}

.preview-item {
    flex: 1;
    text-align: center;
    font-weight: 600;
    font-size: 0.9rem;
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

@media (max-width: 1200px) {
    .mapper-layout {
        grid-template-columns: 1fr;
    }
}
</style>
