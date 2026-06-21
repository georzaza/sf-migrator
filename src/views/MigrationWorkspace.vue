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
                    :options="availableSourceOrgs"
                    optionLabel="name"
                    placeholder="Select Source Org"
                    @change="onSourceOrgChange"
                    :style="{ width: 'max-content' }"
                />
                <div v-if="selectedSourceOrg && selectedSourceOrg.analysisStatus !== 'complete'" class="org-status-message">
                    <Message severity="warn" :closable="false">
                        <template #messageicon>
                            <i class="pi pi-exclamation-triangle"></i>
                        </template>
                        This org needs to be analyzed first.
                        <div class="status-badge">
                            <Tag :value="getStatusLabel(selectedSourceOrg.analysisStatus)" :severity="getStatusSeverity(selectedSourceOrg.analysisStatus)" />
                        </div>
                    </Message>
                </div>
            </div>
            <div class="org-selector">
                <label>Target Org</label>
                <Dropdown
                    v-model="selectedTargetOrg"
                    :options="availableTargetOrgs"
                    optionLabel="name"
                    placeholder="Select Target Org"
                    @change="onTargetOrgChange"
                    :style="{ width: 'max-content' }"
                />
                <div v-if="selectedTargetOrg && selectedTargetOrg.analysisStatus !== 'complete'" class="org-status-message">
                    <Message severity="warn" :closable="false">
                        <template #messageicon>
                            <i class="pi pi-exclamation-triangle"></i>
                        </template>
                        This org needs to be analyzed first. Select the org in the top bar, click on Analyze and wait for completion.
                        <div class="status-badge">
                            <Tag :value="getStatusLabel(selectedTargetOrg.analysisStatus)" :severity="getStatusSeverity(selectedTargetOrg.analysisStatus)" />
                        </div>
                    </Message>
                </div>
            </div>
        </div>

        <!-- Three Column Mapper Layout -->
        <div v-if="bothOrgsAnalyzed" class="mapper-layout">
            <!-- LEFT PANEL - Source -->
            <div class="mapper-panel side-panel">
                <h2>Source</h2>

                <!-- Source Object Selector -->
                <div class="panel-group">
                    <label>Source Object</label>
                    <div class="selector-with-button">
                        <AutoComplete
                            v-model="selectedSourceObject"
                            :suggestions="filteredSourceObjects"
                            @complete="searchSourceObjects"
                            optionLabel="label"
                            placeholder="Type to search objects..."
                            forceSelection
                            dropdown
                            class="w-full"
                            @change="onSourceObjectChange"
                        >
                            <template #option="slotProps">
                                <div>
                                    <div>{{ slotProps.option.label }}</div>
                                    <small>{{ slotProps.option.name }}</small>
                                </div>
                            </template>
                        </AutoComplete>
                        <Button
                            v-if="selectedSourceObject"
                            icon="pi pi-times"
                            severity="secondary"
                            text
                            rounded
                            @click="clearSourceObject"
                            v-tooltip.top="'Clear selection'"
                            class="clear-button"
                        />
                        <Button
                            v-if="selectedSourceObject"
                            icon="pi pi-info-circle"
                            severity="secondary"
                            outlined
                            @click="showObjectDetails(selectedSourceObject, 'source')"
                            v-tooltip.top="'View Object Details'"
                            class="details-button"
                        />
                    </div>
                </div>

                <!-- Source Field Selector -->
                <div class="panel-group">
                    <label>Source Field</label>
                    <div class="selector-with-button">
                        <AutoComplete
                            v-model="selectedSourceField"
                            :suggestions="filteredSourceFields"
                            @complete="searchSourceFields"
                            optionLabel="label"
                            placeholder="Type to search fields..."
                            forceSelection
                            dropdown
                            class="w-full"
                            :disabled="!selectedSourceObject"
                        >
                            <template #option="slotProps">
                                <div>
                                    <div>{{ slotProps.option.label }}</div>
                                    <small>{{ slotProps.option.name }} ({{ slotProps.option.type }})</small>
                                </div>
                            </template>
                        </AutoComplete>
                        <Button
                            v-if="selectedSourceField"
                            icon="pi pi-times"
                            severity="secondary"
                            text
                            rounded
                            @click="clearSourceField"
                            v-tooltip.top="'Clear selection'"
                            class="clear-button"
                        />
                        <Button
                            v-if="selectedSourceField"
                            icon="pi pi-info-circle"
                            severity="secondary"
                            outlined
                            @click="showFieldDetails(selectedSourceField, 'source')"
                            v-tooltip.top="'View Field Details'"
                            class="details-button"
                        />
                    </div>
                </div>
            </div>

            <!-- CENTER PANEL - Mapping Options -->
            <div class="mapper-panel center-panel">
                <h2>Mapping Options</h2>

                <div class="panel-group">
                    <label>Mapping Type</label>
                    <Dropdown
                        v-model="mappingType"
                        :options="mappingTypes"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select Mapping Type"
                        class="w-full"
                        @change="onMappingTypeChange"
                    />
                </div>

                <div v-if="mappingType === 'expression'" class="panel-group">
                    <label>Transformation Rule</label>
                    <Textarea
                        v-model="transformationRule"
                        rows="4"
                        placeholder="Use {Object.Field}, {Object.Field1 || Object.Field2}, {SUBSTR(Object.Field, 2, 5)}"
                        class="w-full"
                    />
                </div>

                <div v-if="mappingType === 'constant'" class="panel-group">
                    <label>Constant Value</label>
                    <InputText
                        v-model="constantValue"
                        placeholder="Enter constant value"
                        class="w-full"
                    />
                </div>

                <div class="mapping-preview">
                    <div class="preview-item">
                        {{ selectedSourceField?.label || (mappingType === 'constant' ? 'Constant' : 'Select source field') }}
                    </div>
                    <i class="pi pi-arrow-right"></i>
                    <div class="preview-item">
                        {{ selectedTargetField?.label || 'Select target field' }}
                    </div>
                </div>

                <Button
                    label="Create Field Mapping"
                    icon="pi pi-plus"
                    @click="createFieldMapping"
                    :loading="mappingStore.loading"
                    :disabled="!canCreateMapping"
                    class="w-full"
                />

                <!-- Same Org Warning -->
                <Message v-if="sameOrgSelected" severity="error" :closable="false" class="mt-2">
                    Source and target org are the same. Mappings cannot be created between an org and itself.
                </Message>

                <!-- Existing Mapping Warning -->
                <Message v-if="!sameOrgSelected && existingTargetFieldMapping" severity="warn" :closable="false" class="mt-2">
                    This target field is already mapped
                </Message>
            </div>

            <!-- RIGHT PANEL - Target -->
            <div class="mapper-panel side-panel">
                <h2>Target</h2>

                <!-- Target Object Selector -->
                <div class="panel-group">
                    <label>Target Object</label>
                    <div class="selector-with-button">
                        <AutoComplete
                            v-model="selectedTargetObject"
                            :suggestions="filteredTargetObjects"
                            @complete="searchTargetObjects"
                            optionLabel="label"
                            placeholder="Type to search objects..."
                            forceSelection
                            dropdown
                            class="w-full"
                            @change="onTargetObjectChange"
                        >
                            <template #option="slotProps">
                                <div>
                                    <div>{{ slotProps.option.label }}</div>
                                    <small>{{ slotProps.option.name }}</small>
                                </div>
                            </template>
                        </AutoComplete>
                        <Button
                            v-if="selectedTargetObject"
                            icon="pi pi-times"
                            severity="secondary"
                            text
                            rounded
                            @click="clearTargetObject"
                            v-tooltip.top="'Clear selection'"
                            class="clear-button"
                        />
                        <Button
                            v-if="selectedTargetObject"
                            icon="pi pi-info-circle"
                            severity="secondary"
                            outlined
                            @click="showObjectDetails(selectedTargetObject, 'target')"
                            v-tooltip.top="'View Object Details'"
                            class="details-button"
                        />
                    </div>
                </div>

                <!-- Target Field Selector -->
                <div class="panel-group">
                    <label>Target Field</label>
                    <div class="selector-with-button">
                        <AutoComplete
                            v-model="selectedTargetField"
                            :suggestions="filteredTargetFields"
                            @complete="searchTargetFields"
                            optionLabel="label"
                            placeholder="Type to search fields..."
                            forceSelection
                            dropdown
                            class="w-full"
                            :disabled="!selectedTargetObject"
                        >
                            <template #option="slotProps">
                                <div>
                                    <div>{{ slotProps.option.label }}</div>
                                    <small>{{ slotProps.option.name }} ({{ slotProps.option.type }})</small>
                                </div>
                            </template>
                        </AutoComplete>
                        <Button
                            v-if="selectedTargetField"
                            icon="pi pi-times"
                            severity="secondary"
                            text
                            rounded
                            @click="clearTargetField"
                            v-tooltip.top="'Clear selection'"
                            class="clear-button"
                        />
                        <Button
                            v-if="selectedTargetField"
                            icon="pi pi-info-circle"
                            severity="secondary"
                            outlined
                            @click="showFieldDetails(selectedTargetField, 'target')"
                            v-tooltip.top="'View Field Details'"
                            class="details-button"
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- Existing Mappings Table -->
        <div v-if="bothOrgsAnalyzed && allFieldMappings.length > 0" class="mappings-section">
            <div class="section-header">
                <h2>All Field Mappings</h2>
                <div class="header-controls">
                    <Button
                        label="Clear All Filters"
                        icon="pi pi-filter-slash"
                        @click="clearFilters"
                        size="small"
                        outlined
                    />
                </div>
            </div>

            <div v-if="selectedSourceObject || selectedTargetObject || selectedSourceField || selectedTargetField" class="filter-info">
                <Message severity="info" :closable="false">
                    <template #messageicon>
                        <i class="pi pi-info-circle"></i>
                    </template>
                    Prioritizing mappings for:
                    <span v-if="selectedSourceObject"> Source Object: <strong>{{ selectedSourceObject.label }}</strong></span>
                    <span v-if="selectedSourceField"> → Field: <strong>{{ selectedSourceField.label }}</strong></span>
                    <span v-if="(selectedSourceObject || selectedSourceField) && (selectedTargetObject || selectedTargetField)"> | </span>
                    <span v-if="selectedTargetObject"> Target Object: <strong>{{ selectedTargetObject.label }}</strong></span>
                    <span v-if="selectedTargetField"> → Field: <strong>{{ selectedTargetField.label }}</strong></span>
                </Message>
            </div>

            <DataTable
                :value="sortedFieldMappings"
                :loading="mappingStore.loading"
                v-model:filters="filters"
                filterDisplay="row"
                :paginator="true"
                :rows="20"
                :rowsPerPageOptions="[10, 20, 50, 100]"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="Showing {first} to {last} of {totalRecords} mappings"
                class="mapping-table"
                sortMode="multiple"
                removableSort
                :rowClass="getRowClass"
            >
                <Column field="sourceObjectLabel" header="Source Object" :sortable="true" style="min-width: 12rem">
                    <template #body="slotProps">
                        <div class="field-label">{{ slotProps.data.sourceObjectLabel }}</div>
                        <div class="field-name">{{ slotProps.data.sourceObjectName }}</div>
                    </template>
                    <template #filter="{ filterModel, filterCallback }">
                        <InputText
                            v-model="filterModel.value"
                            type="text"
                            @input="filterCallback()"
                            placeholder="Search object"
                            class="p-column-filter"
                        />
                    </template>
                </Column>
                <Column field="sourceFieldLabel" header="Source Field" :sortable="true" style="min-width: 12rem">
                    <template #body="slotProps">
                        <div v-if="slotProps.data.sourceField">
                            <div class="field-label">{{ slotProps.data.sourceField.label }}</div>
                            <div class="field-name">{{ slotProps.data.sourceField.name }}</div>
                        </div>
                        <div v-else class="no-source">
                            <i>{{ slotProps.data.mappingType === 'constant' ? 'Constant Value' : 'No Source' }}</i>
                        </div>
                    </template>
                    <template #filter="{ filterModel, filterCallback }">
                        <InputText
                            v-model="filterModel.value"
                            type="text"
                            @input="filterCallback()"
                            placeholder="Search field"
                            class="p-column-filter"
                        />
                    </template>
                </Column>
                <Column field="mappingType" header="Type" :sortable="true" style="min-width: 10rem">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.mappingType" :severity="getMappingTypeSeverity(slotProps.data.mappingType)" />
                    </template>
                    <template #filter="{ filterModel, filterCallback }">
                        <Dropdown
                            v-model="filterModel.value"
                            @change="filterCallback()"
                            :options="['as-is', 'expression', 'constant']"
                            placeholder="Select type"
                            class="p-column-filter"
                            :showClear="true"
                        />
                    </template>
                </Column>
                <Column field="targetObjectLabel" header="Target Object" :sortable="true" style="min-width: 12rem">
                    <template #body="slotProps">
                        <div class="field-label">{{ slotProps.data.targetObjectLabel }}</div>
                        <div class="field-name">{{ slotProps.data.targetObjectName }}</div>
                    </template>
                    <template #filter="{ filterModel, filterCallback }">
                        <InputText
                            v-model="filterModel.value"
                            type="text"
                            @input="filterCallback()"
                            placeholder="Search object"
                            class="p-column-filter"
                        />
                    </template>
                </Column>
                <Column field="targetFieldLabel" header="Target Field" :sortable="true" style="min-width: 12rem">
                    <template #body="slotProps">
                        <div class="field-label">{{ slotProps.data.targetField.label }}</div>
                        <div class="field-name">{{ slotProps.data.targetField.name }}</div>
                    </template>
                    <template #filter="{ filterModel, filterCallback }">
                        <InputText
                            v-model="filterModel.value"
                            type="text"
                            @input="filterCallback()"
                            placeholder="Search field"
                            class="p-column-filter"
                        />
                    </template>
                </Column>
                <Column field="transformationRule" header="Transformation" style="min-width: 12rem">
                    <template #body="slotProps">
                        <span v-if="slotProps.data.mappingType === 'expression'" class="transformation-text">
                            {{ slotProps.data.transformationRule || 'N/A' }}
                        </span>
                        <span v-else-if="slotProps.data.mappingType === 'constant'" class="transformation-text">
                            {{ slotProps.data.constantValue }}
                        </span>
                        <span v-else>-</span>
                    </template>
                </Column>
                <Column header="Actions" :exportable="false" style="min-width: 8rem">
                    <template #body="slotProps">
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
        </div>

        <!-- Delete Field Mapping Dialog -->
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

        <!-- Record Types Dialog -->
        <Dialog
            v-model:visible="showRecordTypesDialog"
            :header="modalTitle"
            :modal="true"
            style="width: 700px"
        >
            <DataTable :value="recordTypesData" class="modal-table">
                <Column field="name" header="Name"></Column>
                <Column field="developerName" header="Developer Name"></Column>
                <Column field="recordTypeId" header="Record Type ID"></Column>
                <Column field="active" header="Active">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.active ? 'Active' : 'Inactive'"
                             :severity="slotProps.data.active ? 'success' : 'secondary'" />
                    </template>
                </Column>
                <Column field="master" header="Master">
                    <template #body="slotProps">
                        <i v-if="slotProps.data.master" class="pi pi-check text-green-500"></i>
                        <i v-else class="pi pi-times text-gray-400"></i>
                    </template>
                </Column>
            </DataTable>
            <template #footer>
                <Button label="Close" icon="pi pi-times" @click="showRecordTypesDialog = false" />
            </template>
        </Dialog>

        <!-- Picklist Values Dialog -->
        <Dialog
            v-model:visible="showPicklistDialog"
            :header="modalTitle"
            :modal="true"
            style="width: 600px"
        >
            <DataTable :value="picklistData" class="modal-table">
                <Column field="label" header="Label"></Column>
                <Column field="value" header="API Value"></Column>
                <Column field="active" header="Active">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.active ? 'Active' : 'Inactive'"
                             :severity="slotProps.data.active ? 'success' : 'secondary'" />
                    </template>
                </Column>
            </DataTable>
            <template #footer>
                <Button label="Close" icon="pi pi-times" @click="showPicklistDialog = false" />
            </template>
        </Dialog>

        <!-- Object Details Dialog -->
        <Dialog
            v-model:visible="showObjectDetailsDialog"
            :header="modalTitle"
            :modal="true"
            style="width: 700px"
        >
            <div v-if="currentDetailsObject" class="details-content">
                <div class="details-grid">
                    <div><strong>Label:</strong> {{ currentDetailsObject.label }}</div>
                    <div><strong>Plural Label:</strong> {{ currentDetailsObject.labelPlural || 'N/A' }}</div>
                    <div><strong>API Name:</strong> {{ currentDetailsObject.name }}</div>
                    <div><strong>Key Prefix:</strong> {{ currentDetailsObject.keyPrefix || 'N/A' }}</div>
                    <div><strong>Custom Object:</strong> {{ formatBoolean(currentDetailsObject.custom) }}</div>
                    <div><strong>Custom Setting:</strong> {{ formatBoolean(currentDetailsObject.customSetting) }}</div>
                    <div v-if="currentDetailsObject.recordCount !== null && currentDetailsObject.recordCount !== undefined">
                        <strong>Record Count:</strong> {{ currentDetailsObject.recordCount?.toLocaleString() }}
                    </div>
                </div>
            </div>
            <template #footer>
                <Button
                    v-if="currentDetailsObject?.recordTypeInfos"
                    label="View Record Types"
                    icon="pi pi-table"
                    severity="secondary"
                    @click="showRecordTypes(currentDetailsObject)"
                />
                <Button label="Close" icon="pi pi-times" @click="showObjectDetailsDialog = false" />
            </template>
        </Dialog>

        <!-- Field Details Dialog -->
        <Dialog
            v-model:visible="showFieldDetailsDialog"
            :header="modalTitle"
            :modal="true"
            style="width: 700px; max-height: 80vh"
        >
            <div v-if="currentDetailsField" class="details-content scrollable-content">
                <div class="details-grid">
                    <div><strong>Label:</strong> {{ currentDetailsField.label }}</div>
                    <div><strong>API Name:</strong> {{ currentDetailsField.name }}</div>
                    <div><strong>Type:</strong> {{ currentDetailsField.type }}</div>
                    <div><strong>Custom:</strong> {{ formatBoolean(currentDetailsField.custom) }}</div>

                    <!-- Dimensions -->
                    <div v-if="currentDetailsField.length"><strong>Length:</strong> {{ currentDetailsField.length }}</div>
                    <div v-if="currentDetailsField.byteLength"><strong>Byte Length:</strong> {{ currentDetailsField.byteLength }}</div>
                    <div v-if="currentDetailsField.precision"><strong>Precision:</strong> {{ currentDetailsField.precision }}</div>
                    <div v-if="currentDetailsField.scale !== null && currentDetailsField.scale !== undefined">
                        <strong>Scale:</strong> {{ currentDetailsField.scale }}
                    </div>
                    <div v-if="currentDetailsField.digits"><strong>Digits:</strong> {{ currentDetailsField.digits }}</div>

                    <!-- Characteristics -->
                    <div><strong>Nillable:</strong> {{ formatBoolean(currentDetailsField.nillable) }}</div>
                    <div><strong>Unique:</strong> {{ formatBoolean(currentDetailsField.unique) }}</div>
                    <div><strong>External ID:</strong> {{ formatBoolean(currentDetailsField.externalId) }}</div>
                    <div><strong>Auto Number:</strong> {{ formatBoolean(currentDetailsField.autoNumber) }}</div>
                    <div><strong>Encrypted:</strong> {{ formatBoolean(currentDetailsField.encrypted) }}</div>
                    <div><strong>ID Lookup:</strong> {{ formatBoolean(currentDetailsField.idLookup) }}</div>

                    <!-- Permissions -->
                    <div><strong>Createable:</strong> {{ formatBoolean(currentDetailsField.createable) }}</div>
                    <div><strong>Updateable:</strong> {{ formatBoolean(currentDetailsField.updateable) }}</div>

                    <!-- Picklist info -->
                    <div v-if="currentDetailsField.type === 'picklist' || currentDetailsField.type === 'multipicklist'">
                        <strong>Restricted:</strong> {{ formatBoolean(currentDetailsField.restrictedPicklist) }}
                    </div>
                    <div v-if="currentDetailsField.dependentPicklist">
                        <strong>Dependent Picklist:</strong> {{ formatBoolean(currentDetailsField.dependentPicklist) }}
                    </div>

                    <!-- Formulas and defaults -->
                    <div><strong>Calculated:</strong> {{ formatBoolean(currentDetailsField.calculated) }}</div>
                    <div v-if="currentDetailsField.calculatedFormula" class="formula-field">
                        <strong>Formula:</strong>
                        <code>{{ currentDetailsField.calculatedFormula }}</code>
                    </div>
                    <div><strong>Defaulted on Create:</strong> {{ formatBoolean(currentDetailsField.defaultedOnCreate) }}</div>
                    <div v-if="currentDetailsField.defaultValue">
                        <strong>Default Value:</strong> {{ currentDetailsField.defaultValue }}
                    </div>
                    <div v-if="currentDetailsField.defaultValueFormula">
                        <strong>Default Formula:</strong>
                        <code>{{ currentDetailsField.defaultValueFormula }}</code>
                    </div>

                    <!-- Relationship info -->
                    <div v-if="currentDetailsField.relationshipName">
                        <strong>Relationship Name:</strong> {{ currentDetailsField.relationshipName }}
                    </div>
                    <div v-if="currentDetailsField.referenceTo">
                        <strong>References:</strong> {{ formatJsonArray(currentDetailsField.referenceTo) }}
                    </div>

                    <!-- Compound fields -->
                    <div v-if="currentDetailsField.compoundFieldName">
                        <strong>Compound Field:</strong> {{ currentDetailsField.compoundFieldName }}
                    </div>

                    <!-- Help text -->
                    <div v-if="currentDetailsField.inlineHelpText" class="help-text-field">
                        <strong>Help Text:</strong> {{ currentDetailsField.inlineHelpText }}
                    </div>
                </div>
            </div>
            <template #footer>
                <Button
                    v-if="currentDetailsField?.picklistValues"
                    label="View Picklist Values"
                    icon="pi pi-list"
                    severity="secondary"
                    @click="showPicklistValues(currentDetailsField)"
                />
                <Button label="Close" icon="pi pi-times" @click="showFieldDetailsDialog = false" />
            </template>
        </Dialog>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useOrgStore } from '@/stores/orgStore';
import { useMappingStore } from '@/stores/mappingStore';
import { useMetadataStore } from '@/stores/metadataStore';
import { useToast } from 'primevue/usetoast';
import { FilterMatchMode } from '@primevue/core/api';

const router = useRouter();
const orgStore = useOrgStore();
const mappingStore = useMappingStore();
const metadataStore = useMetadataStore();
const toast = useToast();

// State
const selectedSourceOrg = ref(null);
const selectedTargetOrg = ref(null);
const sourceObjects = ref([]);
const targetObjects = ref([]);
const filteredSourceObjects = ref([]);
const filteredTargetObjects = ref([]);
const selectedSourceObject = ref(null);
const selectedTargetObject = ref(null);
const sourceFields = ref([]);
const targetFields = ref([]);
const filteredSourceFields = ref([]);
const filteredTargetFields = ref([]);
const selectedSourceField = ref(null);
const selectedTargetField = ref(null);
const mappingType = ref('as-is');
const transformationRule = ref(null);
const constantValue = ref(null);
const showDeleteDialog = ref(false);
const fieldMappingToDelete = ref(null);
const currentObjectMapping = ref(null);
const allFieldMappings = ref([]);

// Table filtering and pagination
const filters = ref({
    'sourceObjectLabel': { value: null, matchMode: FilterMatchMode.CONTAINS },
    'sourceObjectName': { value: null, matchMode: FilterMatchMode.CONTAINS },
    'targetObjectLabel': { value: null, matchMode: FilterMatchMode.CONTAINS },
    'targetObjectName': { value: null, matchMode: FilterMatchMode.CONTAINS },
    'sourceFieldLabel': { value: null, matchMode: FilterMatchMode.CONTAINS },
    'sourceFieldName': { value: null, matchMode: FilterMatchMode.CONTAINS },
    'targetFieldLabel': { value: null, matchMode: FilterMatchMode.CONTAINS },
    'targetFieldName': { value: null, matchMode: FilterMatchMode.CONTAINS },
    'mappingType': { value: null, matchMode: FilterMatchMode.EQUALS }
});

// Modal states
const showRecordTypesDialog = ref(false);
const showPicklistDialog = ref(false);
const showObjectDetailsDialog = ref(false);
const showFieldDetailsDialog = ref(false);
const recordTypesData = ref([]);
const picklistData = ref([]);
const currentDetailsObject = ref(null);
const currentDetailsField = ref(null);
const modalTitle = ref('');

const mappingTypes = [
    { label: 'As-Is (Direct Copy)', value: 'as-is' },
    { label: 'Expression/Transform', value: 'expression' },
    { label: 'Constant Value', value: 'constant' }
];

// Computed
const orgs = computed(() => orgStore.orgs || []);

const availableSourceOrgs = computed(() => orgs.value);

const availableTargetOrgs = computed(() => orgs.value);

const sameOrgSelected = computed(() => {
    return !!(selectedSourceOrg.value && selectedTargetOrg.value && selectedSourceOrg.value.id === selectedTargetOrg.value.id);
});

const bothOrgsAnalyzed = computed(() => {
    return selectedSourceOrg.value
        && selectedTargetOrg.value
        && selectedSourceOrg.value.analysisStatus === 'complete'
        && selectedTargetOrg.value.analysisStatus === 'complete';
});

const sortedFieldMappings = computed(() => {
    let mappings = [...allFieldMappings.value];

    // Sort mappings to prioritize selected objects and fields
    if (selectedSourceObject.value || selectedTargetObject.value || selectedSourceField.value || selectedTargetField.value) {
        mappings.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;

            // Higher score for matching source object
            if (selectedSourceObject.value) {
                if (a.sourceObject?.id === selectedSourceObject.value.id) scoreA += 2;
                if (b.sourceObject?.id === selectedSourceObject.value.id) scoreB += 2;
            }

            // Higher score for matching target object
            if (selectedTargetObject.value) {
                if (a.targetObject?.id === selectedTargetObject.value.id) scoreA += 2;
                if (b.targetObject?.id === selectedTargetObject.value.id) scoreB += 2;
            }

            // Even higher score for matching source field
            if (selectedSourceField.value) {
                if (a.sourceField?.id === selectedSourceField.value.id) scoreA += 3;
                if (b.sourceField?.id === selectedSourceField.value.id) scoreB += 3;
            }

            // Even higher score for matching target field
            if (selectedTargetField.value) {
                if (a.targetField?.id === selectedTargetField.value.id) scoreA += 3;
                if (b.targetField?.id === selectedTargetField.value.id) scoreB += 3;
            }

            // Sort by score (higher first), then by ID for stability
            if (scoreB !== scoreA) {
                return scoreB - scoreA;
            }
            return (a.id || 0) - (b.id || 0);
        });
    }

    return mappings;
});

const canCreateMapping = computed(() => {
    if (sameOrgSelected.value) return false;
    if (!selectedTargetField.value) return false;

    if (mappingType.value === 'expression') {
        return !!transformationRule.value;
    }

    if (mappingType.value === 'constant') {
        return !!constantValue.value;
    }

    return !!selectedSourceField.value;
});

// Check if a mapping already exists for the selected target object + field
const existingTargetFieldMapping = computed(() => {
    if (!selectedTargetObject.value || !selectedTargetField.value) return null;

    return allFieldMappings.value.find(mapping =>
        mapping.targetObject?.id === selectedTargetObject.value.id &&
        mapping.targetField?.id === selectedTargetField.value.id
    );
});

// Methods
async function onSourceOrgChange() {
    selectedSourceObject.value = null;
    selectedSourceField.value = null;
    sourceObjects.value = [];
    sourceFields.value = [];
    filteredSourceObjects.value = [];
    filteredSourceFields.value = [];

    if (selectedSourceOrg.value) {
        await loadSourceObjects();
    }

    await loadObjectMappingIfBothSelected();
    await loadAllFieldMappings();
}

async function onTargetOrgChange() {
    selectedTargetObject.value = null;
    selectedTargetField.value = null;
    targetObjects.value = [];
    targetFields.value = [];
    filteredTargetObjects.value = [];
    filteredTargetFields.value = [];

    if (selectedTargetOrg.value) {
        await loadTargetObjects();
    }

    await loadObjectMappingIfBothSelected();
    await loadAllFieldMappings();
}

async function onSourceObjectChange() {
    selectedSourceField.value = null;
    sourceFields.value = [];
    filteredSourceFields.value = [];

    if (selectedSourceObject.value) {
        await loadSourceFields();
    }

    await loadObjectMappingIfBothSelected();
}

async function onTargetObjectChange() {
    selectedTargetField.value = null;
    targetFields.value = [];
    filteredTargetFields.value = [];

    if (selectedTargetObject.value) {
        await loadTargetFields();
    }

    await loadObjectMappingIfBothSelected();
}

async function loadSourceObjects() {
    try {
        sourceObjects.value = await metadataStore.loadObjects(selectedSourceOrg.value.id);
        filteredSourceObjects.value = sourceObjects.value;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load source objects', life: 3000 });
    }
}

async function loadTargetObjects() {
    try {
        targetObjects.value = await metadataStore.loadObjects(selectedTargetOrg.value.id);
        filteredTargetObjects.value = targetObjects.value;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load target objects', life: 3000 });
    }
}

async function loadSourceFields() {
    try {
        sourceFields.value = await metadataStore.loadFields(selectedSourceObject.value.id);
        filteredSourceFields.value = sourceFields.value;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load source fields', life: 3000 });
    }
}

async function loadTargetFields() {
    try {
        targetFields.value = await metadataStore.loadFields(selectedTargetObject.value.id);
        filteredTargetFields.value = targetFields.value;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load target fields', life: 3000 });
    }
}

// AutoComplete search methods
function searchSourceObjects(event) {
    const query = event.query.toLowerCase();
    if (!query) {
        filteredSourceObjects.value = [...sourceObjects.value];
    } else {
        filteredSourceObjects.value = sourceObjects.value.filter(obj =>
            obj.label.toLowerCase().includes(query) ||
            obj.name.toLowerCase().includes(query)
        );
    }
}

function searchTargetObjects(event) {
    const query = event.query.toLowerCase();
    if (!query) {
        filteredTargetObjects.value = [...targetObjects.value];
    } else {
        filteredTargetObjects.value = targetObjects.value.filter(obj =>
            obj.label.toLowerCase().includes(query) ||
            obj.name.toLowerCase().includes(query)
        );
    }
}

function searchSourceFields(event) {
    const query = event.query.toLowerCase();
    if (!query) {
        filteredSourceFields.value = [...sourceFields.value];
    } else {
        filteredSourceFields.value = sourceFields.value.filter(field =>
            field.label.toLowerCase().includes(query) ||
            field.name.toLowerCase().includes(query) ||
            field.type.toLowerCase().includes(query)
        );
    }
}

function searchTargetFields(event) {
    const query = event.query.toLowerCase();
    if (!query) {
        filteredTargetFields.value = [...targetFields.value];
    } else {
        filteredTargetFields.value = targetFields.value.filter(field =>
            field.label.toLowerCase().includes(query) ||
            field.name.toLowerCase().includes(query) ||
            field.type.toLowerCase().includes(query)
        );
    }
}

// Clear methods
function clearSourceObject() {
    selectedSourceObject.value = null;
    onSourceObjectChange();
}

function clearTargetObject() {
    selectedTargetObject.value = null;
    onTargetObjectChange();
}

function clearSourceField() {
    selectedSourceField.value = null;
}

function clearTargetField() {
    selectedTargetField.value = null;
}

async function loadObjectMappingIfBothSelected() {
    if (!selectedSourceObject.value || !selectedTargetObject.value) {
        currentObjectMapping.value = null;
        return;
    }

    try {
        // Try to find existing object mapping
        await mappingStore.loadMappings(selectedSourceOrg.value.id, selectedTargetOrg.value.id);

        const existingMapping = mappingStore.objectMappings.find(
            m => m.sourceObjectId === selectedSourceObject.value.id
                && m.targetObjectId === selectedTargetObject.value.id
        );

        if (existingMapping) {
            currentObjectMapping.value = existingMapping;
        } else {
            currentObjectMapping.value = null;
        }
    } catch (error) {
        console.error('Error loading object mapping:', error);
    }
}

async function loadAllFieldMappings() {
    if (!selectedSourceOrg.value || !selectedTargetOrg.value) {
        allFieldMappings.value = [];
        return;
    }

    try {
        // Load all object mappings for this org pair
        await mappingStore.loadMappings(selectedSourceOrg.value.id, selectedTargetOrg.value.id);

        // Load all field mappings for each object mapping
        const allMappings = [];
        for (const objMapping of mappingStore.objectMappings) {
            await mappingStore.loadFieldMappings(objMapping.id);

            // Enrich field mappings with object information
            const enrichedMappings = mappingStore.fieldMappings.map(fm => ({
                ...fm,
                sourceObject: sourceObjects.value.find(o => o.id === objMapping.sourceObjectId),
                targetObject: targetObjects.value.find(o => o.id === objMapping.targetObjectId),
                sourceObjectLabel: sourceObjects.value.find(o => o.id === objMapping.sourceObjectId)?.label || 'Unknown',
                sourceObjectName: sourceObjects.value.find(o => o.id === objMapping.sourceObjectId)?.name || 'Unknown',
                targetObjectLabel: targetObjects.value.find(o => o.id === objMapping.targetObjectId)?.label || 'Unknown',
                targetObjectName: targetObjects.value.find(o => o.id === objMapping.targetObjectId)?.name || 'Unknown',
                sourceFieldLabel: fm.sourceField?.label || (fm.mappingType === 'constant' ? 'Constant' : 'N/A'),
                sourceFieldName: fm.sourceField?.name || 'N/A',
                targetFieldLabel: fm.targetField?.label || 'Unknown',
                targetFieldName: fm.targetField?.name || 'Unknown'
            }));

            allMappings.push(...enrichedMappings);
        }

        allFieldMappings.value = allMappings;
    } catch (error) {
        console.error('Error loading all field mappings:', error);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load field mappings', life: 3000 });
    }
}

function clearFilters() {
    filters.value = {
        'sourceObjectLabel': { value: null, matchMode: FilterMatchMode.CONTAINS },
        'sourceObjectName': { value: null, matchMode: FilterMatchMode.CONTAINS },
        'targetObjectLabel': { value: null, matchMode: FilterMatchMode.CONTAINS },
        'targetObjectName': { value: null, matchMode: FilterMatchMode.CONTAINS },
        'sourceFieldLabel': { value: null, matchMode: FilterMatchMode.CONTAINS },
        'sourceFieldName': { value: null, matchMode: FilterMatchMode.CONTAINS },
        'targetFieldLabel': { value: null, matchMode: FilterMatchMode.CONTAINS },
        'targetFieldName': { value: null, matchMode: FilterMatchMode.CONTAINS },
        'mappingType': { value: null, matchMode: FilterMatchMode.EQUALS }
    };
}

function onMappingTypeChange() {
    if (mappingType.value === 'constant') {
        selectedSourceField.value = null;
        transformationRule.value = null;
    } else if (mappingType.value === 'as-is') {
        transformationRule.value = null;
        constantValue.value = null;
    } else {
        constantValue.value = null;
    }
}

async function createFieldMapping() {
    if (!selectedSourceObject.value || !selectedTargetObject.value) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: 'Please select source and target objects', life: 3000 });
        return;
    }

    if (!selectedTargetField.value) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: 'Please select a target field', life: 3000 });
        return;
    }

    if (mappingType.value === 'as-is' && !selectedSourceField.value) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: 'Please select a source field', life: 3000 });
        return;
    }

    if (mappingType.value === 'expression' && !transformationRule.value) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: 'Please provide a transformation rule', life: 3000 });
        return;
    }

    try {
        // Create object mapping if it doesn't exist
        if (!currentObjectMapping.value) {
            currentObjectMapping.value = await mappingStore.createMapping(
                selectedSourceObject.value.id,
                selectedTargetObject.value.id
            );
        }

        // Create field mapping
        const data = {
            sourceObjectId: selectedSourceObject.value.id,
            targetObjectId: selectedTargetObject.value.id,
            targetFieldId: selectedTargetField.value.id,
            mappingType: mappingType.value
        };

        if (mappingType.value === 'as-is') {
            data.sourceFieldId = selectedSourceField.value.id;
        }

        if (mappingType.value === 'expression') {
            data.transformationRule = transformationRule.value;
        }

        if (mappingType.value === 'constant') {
            data.constantValue = constantValue.value;
        }

        await mappingStore.createFieldMapping(data);

        toast.add({ severity: 'success', summary: 'Success', detail: 'Field mapping created successfully', life: 3000 });

        // Reload all field mappings to show the new one
        await loadAllFieldMappings();

        // Reset field selections
        resetFieldSelection();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to create field mapping', life: 3000 });
    }
}

function resetFieldSelection() {
    if (mappingType.value !== 'constant') {
        selectedSourceField.value = null;
    }
    selectedTargetField.value = null;
    transformationRule.value = null;
    constantValue.value = null;
}

function confirmDeleteFieldMapping(fieldMapping) {
    fieldMappingToDelete.value = fieldMapping;
    showDeleteDialog.value = true;
}

async function deleteFieldMapping() {
    try {
        await mappingStore.deleteFieldMapping(fieldMappingToDelete.value.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Field mapping deleted successfully', life: 3000 });
        showDeleteDialog.value = false;
        fieldMappingToDelete.value = null;

        // Reload all field mappings
        await loadAllFieldMappings();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to delete field mapping', life: 3000 });
    }
}

function getMappingTypeSeverity(type) {
    const severityMap = {
        'as-is': 'success',
        'expression': 'warning',
        'constant': 'info'
    };
    return severityMap[type] || 'secondary';
}

// Highlight row if it matches the existing target field mapping
function getRowClass(data) {
    if (existingTargetFieldMapping.value &&
        data.targetObject?.id === existingTargetFieldMapping.value.targetObject?.id &&
        data.targetField?.id === existingTargetFieldMapping.value.targetField?.id) {
        return 'highlight-row';
    }
    return '';
}

function getStatusLabel(status) {
    const labels = {
        'idle': 'Not Analyzed',
        'running': 'Analyzing...',
        'complete': 'Complete',
        'failed': 'Failed',
        'auth_required': 'Auth Required'
    };
    return labels[status] || status;
}

function getStatusSeverity(status) {
    const severityMap = {
        'idle': 'info',
        'running': 'info',
        'complete': 'success',
        'failed': 'danger',
        'auth_required': 'warning'
    };
    return severityMap[status] || 'secondary';
}

// Show object details modal
function showObjectDetails(object, type) {
    currentDetailsObject.value = object;
    modalTitle.value = `${type === 'source' ? 'Source' : 'Target'} Object Details: ${object.label}`;
    showObjectDetailsDialog.value = true;
}

// Show field details modal
function showFieldDetails(field, type) {
    currentDetailsField.value = field;
    modalTitle.value = `${type === 'source' ? 'Source' : 'Target'} Field Details: ${field.label}`;
    showFieldDetailsDialog.value = true;
}

// Show record types modal
function showRecordTypes(object) {
    if (!object.recordTypeInfos) {
        toast.add({ severity: 'info', summary: 'No Record Types', detail: 'This object has no record types', life: 3000 });
        return;
    }

    try {
        // Parse if it's a string, otherwise use as-is
        const recordTypes = typeof object.recordTypeInfos === 'string'
            ? JSON.parse(object.recordTypeInfos)
            : object.recordTypeInfos;

        recordTypesData.value = Array.isArray(recordTypes) ? recordTypes : [];
        modalTitle.value = `Record Types for ${object.label}`;
        showRecordTypesDialog.value = true;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to parse record types', life: 3000 });
    }
}

// Show picklist values modal
function showPicklistValues(field) {
    if (!field.picklistValues) {
        toast.add({ severity: 'info', summary: 'No Picklist Values', detail: 'This field has no picklist values', life: 3000 });
        return;
    }

    try {
        // Parse if it's a string, otherwise use as-is
        const picklistValues = typeof field.picklistValues === 'string'
            ? JSON.parse(field.picklistValues)
            : field.picklistValues;

        picklistData.value = Array.isArray(picklistValues) ? picklistValues : [];
        modalTitle.value = `Picklist Values for ${field.label}`;
        showPicklistDialog.value = true;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to parse picklist values', life: 3000 });
    }
}

// Helper to format boolean values for display
function formatBoolean(value) {
    if (value === null || value === undefined) return 'N/A';
    return value ? 'Yes' : 'No';
}

// Helper to format JSON arrays for display
function formatJsonArray(value, prop = null) {
    if (!value) return 'N/A';
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (Array.isArray(parsed)) {
            if (prop) {
                return parsed.map(item => item[prop]).join(', ');
            }
            return parsed.join(', ');
        }
        return String(value);
    } catch {
        return String(value);
    }
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
    max-width: 1600px;
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

.org-status-message {
    margin-top: 0.75rem;
}

.org-status-message .status-badge {
    margin-top: 0.5rem;
}

.arrow-icon {
    font-size: 1.5rem;
    color: var(--primary-color);
    margin-top: 1.5rem;
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
    padding: 1.25rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.mapper-panel h2 {
    margin: 0 0 1.25rem;
    font-size: 1.15rem;
    color: var(--primary-color);
    border-bottom: 2px solid var(--primary-color);
    padding-bottom: 0.5rem;
}

.panel-group {
    margin-bottom: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.panel-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    font-size: 0.95rem;
}

.selector-with-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.selector-with-button > :first-child {
    flex: 1;
    min-width: 0;
}

.details-button {
    flex-shrink: 0;
}

.clear-button {
    flex-shrink: 0;
}

.details-content {
    padding: 1rem 0;
}

.scrollable-content {
    max-height: 60vh;
    overflow-y: auto;
    padding-right: 0.5rem;
}

.details-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.6rem;
    line-height: 1.6;
}

.details-grid > div {
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--surface-border);
}

.details-grid > div:last-child {
    border-bottom: none;
}

.details-grid > div {
    padding: 0.25rem 0;
}

.details-grid strong {
    color: var(--text-color);
}

.details-grid code {
    display: block;
    margin-top: 0.25rem;
    padding: 0.5rem;
    background: var(--surface-ground);
    border: 1px solid var(--surface-border);
    border-radius: 4px;
    font-size: 0.85rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-color);
}

.formula-field, .help-text-field {
    grid-column: 1 / -1;
}

.modal-table {
    margin-top: 1rem;
}

.center-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.mapping-preview {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--surface-ground);
    border-radius: 6px;
    border: 2px dashed var(--surface-border);
}

.preview-item {
    flex: 1;
    text-align: center;
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-color);
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
    margin: 0;
}

.header-controls {
    display: flex;
    gap: 0.5rem;
}

.filter-info {
    margin-bottom: 1rem;
}

.mapping-table {
    background: var(--surface-card);
    border-radius: 8px;
}

.mapping-table :deep(.highlight-row) {
    background-color: var(--yellow-50) !important;
    border-left: 3px solid var(--yellow-500);
}

.mapping-table :deep(.highlight-row):hover {
    background-color: var(--yellow-100) !important;
}

.field-label {
    font-weight: 600;
    margin-bottom: 0.25rem;
}

.field-name {
    font-family: monospace;
    font-size: 0.85rem;
    color: var(--text-color-secondary);
}

.no-source {
    color: var(--text-color-secondary);
    font-style: italic;
}

.transformation-text {
    display: block;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mapping-table :deep(.p-column-filter) {
    width: 100%;
}

.mapping-table :deep(.p-datatable-thead > tr > th) {
    background: var(--surface-card);
    color: var(--text-color);
    font-weight: 600;
}

.mapping-table :deep(.p-paginator) {
    padding: 1rem;
    background: var(--surface-card);
}

@media (max-width: 1200px) {
    .mapper-layout {
        grid-template-columns: 1fr;
    }

    .org-selector-section {
        flex-direction: column;
        align-items: stretch;
    }

    .arrow-icon {
        margin-top: 0;
        transform: rotate(90deg);
    }
}
</style>
