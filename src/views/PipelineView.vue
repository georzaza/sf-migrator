<template>
    <div class="pipeline-view">
        <!-- Header -->
        <div class="pipeline-header">
            <div class="header-left">
                <div class="header-titles">
                    <h1>Migration Pipeline</h1>
                    <p class="subtitle">Extract, transform and load records from source to target</p>
                </div>
            </div>
            <div class="header-right">
                <Tag :value="overallStatusLabel" :severity="overallStatusSeverity" />
                <Button
                    label="Run Migration"
                    icon="pi pi-play"
                    :loading="running"
                    :disabled="!bothOrgsAnalyzed || running"
                    @click="onRunMigration"
                />
            </div>
        </div>

        <!-- Org selectors -->
        <div class="org-selector-section">
            <div class="org-selector">
                <label>Source Org</label>
                <Dropdown
                    v-model="selectedSourceOrg"
                    :options="orgs"
                    optionLabel="name"
                    :optionDisabled="isSourceOrgDisabled"
                    placeholder="Select Source Org"
                    @change="onOrgChange"
                    :style="{ width: '16rem' }"
                />
                <div v-if="selectedSourceOrg && selectedSourceOrg.analysisStatus !== 'complete'" class="org-status-message">
                    <Message severity="warn" :closable="false">This org needs to be analyzed first.</Message>
                </div>
            </div>

            <i class="pi pi-arrow-right org-arrow"></i>

            <div class="org-selector">
                <label>Target Org</label>
                <Dropdown
                    v-model="selectedTargetOrg"
                    :options="orgs"
                    optionLabel="name"
                    :optionDisabled="isTargetOrgDisabled"
                    placeholder="Select Target Org"
                    @change="onOrgChange"
                    :style="{ width: '16rem' }"
                />
                <div v-if="selectedTargetOrg && selectedTargetOrg.analysisStatus !== 'complete'" class="org-status-message">
                    <Message severity="warn" :closable="false">This org needs to be analyzed first.</Message>
                </div>
            </div>
        </div>

        <div v-if="!bothOrgsAnalyzed" class="empty-state">
            <i class="pi pi-sitemap"></i>
            <p>Select an analyzed source and target org to view the migration pipeline.</p>
        </div>

        <template v-else>
            <!-- Stage strip -->
            <div class="stage-strip">
                <!-- Extract -->
                <div class="stage-card">
                    <div class="stage-card-head">
                        <span class="stage-name"><i class="pi pi-cloud-download"></i> Extract</span>
                        <Tag :value="stageLabel(pipeline.extractionStatus.extractionStatus)" :severity="stageSeverity(pipeline.extractionStatus.extractionStatus)" />
                    </div>
                    <div class="stage-card-body">
                        <template v-if="pipeline.extractionStatus.extractionStatus === 'running'">
                            <p class="stage-current">
                                {{ pipeline.extractionStatus.currentObject || 'Starting…' }}
                                <span v-if="pipeline.extractionStatus.objectsRemaining != null">
                                    ({{ pipeline.extractionStatus.objectsRemaining }} remaining)
                                </span>
                            </p>
                            <ProgressBar mode="indeterminate" style="height: 0.5rem" />
                        </template>
                        <template v-else-if="pipeline.extractionStatus.summary">
                            <p class="stage-summary">
                                {{ pipeline.extractionStatus.summary.successCount ?? 0 }} ok /
                                {{ pipeline.extractionStatus.summary.failedCount ?? 0 }} failed
                                of {{ pipeline.extractionStatus.summary.totalObjects ?? 0 }}
                            </p>
                        </template>
                        <p v-else class="stage-hint">Extract source records into staging before running.</p>
                    </div>
                    <Button
                        label="Run extraction"
                        icon="pi pi-cloud-download"
                        size="small"
                        outlined
                        :loading="extracting"
                        :disabled="extracting || running"
                        @click="onRunExtraction"
                    />
                </div>

                <!-- Transform -->
                <div class="stage-card">
                    <div class="stage-card-head">
                        <span class="stage-name"><i class="pi pi-sync"></i> Transform</span>
                        <Tag :value="stageLabel(pipeline.transformStatus.status)" :severity="stageSeverity(pipeline.transformStatus.status)" />
                    </div>
                    <div class="stage-card-body">
                        <template v-if="pipeline.transformStatus.progress">
                            <p class="stage-current">
                                {{ pipeline.transformStatus.progress.currentObject || 'Working…' }}
                            </p>
                            <ProgressBar :value="transformProgress" style="height: 0.5rem" />
                            <p class="stage-count">{{ pipeline.transformStatus.progress.completed }} / {{ pipeline.transformStatus.progress.total }}</p>
                        </template>
                        <template v-else-if="pipeline.transformStatus.summary">
                            <p class="stage-summary">
                                {{ pipeline.transformStatus.summary.successCount ?? 0 }} ok /
                                {{ pipeline.transformStatus.summary.failedCount ?? 0 }} failed
                            </p>
                        </template>
                        <p v-else class="stage-hint">Maps staged records to the target schema.</p>
                    </div>
                </div>

                <!-- Load -->
                <div class="stage-card">
                    <div class="stage-card-head">
                        <span class="stage-name"><i class="pi pi-upload"></i> Load</span>
                        <Tag :value="stageLabel(pipeline.loadStatus.status)" :severity="stageSeverity(pipeline.loadStatus.status)" />
                    </div>
                    <div class="stage-card-body">
                        <template v-if="pipeline.loadStatus.progress">
                            <p class="stage-current">
                                <span v-if="pipeline.loadStatus.progress.pass">Pass {{ pipeline.loadStatus.progress.pass }}: </span>
                                {{ pipeline.loadStatus.progress.currentObject || 'Working…' }}
                            </p>
                            <ProgressBar :value="loadProgress" style="height: 0.5rem" />
                            <p class="stage-count">{{ pipeline.loadStatus.progress.completed }} / {{ pipeline.loadStatus.progress.total }}</p>
                        </template>
                        <template v-else-if="pipeline.loadStatus.summary">
                            <p class="stage-summary">{{ loadLoadedTotal }} loaded / {{ loadFailedTotal }} failed</p>
                        </template>
                        <p v-else class="stage-hint">Inserts/updates records into the target org.</p>
                    </div>
                </div>
            </div>

            <Message
                v-if="pipeline.extractionStatus.extractionStatus !== 'complete'"
                severity="info"
                :closable="false"
                class="prereq-note"
            >
                Make sure source data has been extracted before running the migration.
            </Message>

            <!-- Load plan readiness -->
            <div class="section-card">
                <div class="section-head">
                    <h2><i class="pi pi-list"></i> Load Plan</h2>
                    <span class="section-sub">Objects load in dependency order. Pick the External-Id used to trace records back.</span>
                </div>
                <DataTable :value="pipeline.loadPlan.loadOrder" :loading="pipeline.loading" size="small" class="plan-table">
                    <template #empty><span>No load plan available. Map objects in the workspace first.</span></template>
                    <Column header="#" style="width: 3rem">
                        <template #body="{ index }">{{ index + 1 }}</template>
                    </Column>
                    <Column field="sourceObjectName" header="Source Object" style="min-width: 12rem" />
                    <Column field="targetObjectName" header="Target Object" style="min-width: 12rem" />
                    <Column header="External-Id Field" style="min-width: 18rem">
                        <template #body="{ data }">
                            <TracebackFieldSelect
                                :sourceObjectId="data.sourceObjectId"
                                :targetObjectId="data.targetObjectId"
                                :showWarnings="false"
                                @change="onTracebackChange"
                            />
                        </template>
                    </Column>
                </DataTable>

                <div v-if="pipeline.loadPlan.deferredFields.length" class="deferred-block">
                    <h3><i class="pi pi-clock"></i> Deferred lookups (second pass)</h3>
                    <DataTable :value="pipeline.loadPlan.deferredFields" size="small">
                        <Column field="sourceObjectName" header="Object" style="min-width: 10rem" />
                        <Column field="fieldName" header="Field" style="min-width: 10rem" />
                        <Column field="referencedObjectName" header="References" style="min-width: 10rem" />
                        <Column field="reason" header="Reason" style="min-width: 14rem" />
                    </DataTable>
                </div>
            </div>

            <!-- Transform results -->
            <div v-if="transformResults.length" class="section-card">
                <div class="section-head">
                    <h2><i class="pi pi-sync"></i> Transform Results</h2>
                </div>
                <DataTable :value="transformResults" size="small">
                    <Column field="targetObject" header="Target Object" style="min-width: 11rem" />
                    <Column field="drivingObject" header="Driving Object" style="min-width: 11rem" />
                    <Column field="rowCount" header="Rows" style="width: 6rem" />
                    <Column field="successCount" header="Success" style="width: 7rem" />
                    <Column field="errorCount" header="Errors" style="width: 6rem" />
                    <Column header="Status" style="width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="data.status" :severity="resultSeverity(data.status)" />
                        </template>
                    </Column>
                    <Column field="errorMessage" header="Message" style="min-width: 14rem">
                        <template #body="{ data }">
                            <span class="error-cell">{{ data.errorMessage }}</span>
                        </template>
                    </Column>
                </DataTable>
            </div>

            <!-- Load results -->
            <div v-if="loadResults.length" class="section-card">
                <div class="section-head">
                    <h2><i class="pi pi-upload"></i> Load Results</h2>
                </div>
                <DataTable :value="loadResults" size="small">
                    <Column field="targetObject" header="Target Object" style="min-width: 11rem" />
                    <Column header="Status" style="width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="data.status" :severity="resultSeverity(data.status)" />
                        </template>
                    </Column>
                    <Column field="total" header="Total" style="width: 6rem" />
                    <Column field="ready" header="Ready" style="width: 6rem" />
                    <Column field="loaded" header="Loaded" style="width: 6rem" />
                    <Column field="failed" header="Failed" style="width: 6rem" />
                    <Column field="skipped" header="Skipped" style="width: 6rem" />
                    <Column field="deferredUpdated" header="Deferred" style="width: 7rem" />
                    <Column header="Actions" style="min-width: 12rem">
                        <template #body="{ data }">
                            <div class="row-actions">
                                <Button
                                    v-if="data.loaded > 0"
                                    icon="pi pi-download"
                                    size="small"
                                    text
                                    v-tooltip.top="'Download success CSV'"
                                    :disabled="!loadRunId"
                                    @click="downloadCsv(data.targetObject, 'success')"
                                />
                                <Button
                                    v-if="data.failed > 0"
                                    icon="pi pi-download"
                                    severity="danger"
                                    size="small"
                                    text
                                    v-tooltip.top="'Download errors CSV'"
                                    :disabled="!loadRunId"
                                    @click="downloadCsv(data.targetObject, 'error')"
                                />
                                <Button
                                    v-if="data.failed > 0 || data.skipped > 0"
                                    icon="pi pi-search"
                                    size="small"
                                    text
                                    v-tooltip.top="'View record details'"
                                    @click="viewErrors(data.targetObject)"
                                />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </template>

        <LoadErrorDialog
            v-model:visible="showErrorDialog"
            :targetOrgId="targetOrgId"
            :targetObjectName="errorObjectName"
            :objectLabel="errorObjectName"
        />
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useOrgStore } from '@/stores/orgStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { usePipeline } from '@/composables/usePipeline';
import { findOrgById, loadMigrationSelection, saveMigrationSelection } from '@/utils/migrationSelection';
import TracebackFieldSelect from '@/components/pipeline/TracebackFieldSelect.vue';
import LoadErrorDialog from '@/components/pipeline/LoadErrorDialog.vue';

const route = useRoute();
const toast = useToast();
const orgStore = useOrgStore();
const pipeline = usePipelineStore();
const { currentStage, running, extracting, runExtraction, runMigration, resumeIfRunning, stopPolling } = usePipeline();

const selectedSourceOrg = ref(null);
const selectedTargetOrg = ref(null);

const showErrorDialog = ref(false);
const errorObjectName = ref(null);

const orgs = computed(() => orgStore.orgs || []);
const sourceOrgId = computed(() => selectedSourceOrg.value?.id ?? null);
const targetOrgId = computed(() => selectedTargetOrg.value?.id ?? null);

const bothOrgsAnalyzed = computed(() =>
    selectedSourceOrg.value
    && selectedTargetOrg.value
    && selectedSourceOrg.value.analysisStatus === 'complete'
    && selectedTargetOrg.value.analysisStatus === 'complete',
);

function isSourceOrgDisabled(org) {
    return !!(selectedTargetOrg.value && org.id === selectedTargetOrg.value.id);
}
function isTargetOrgDisabled(org) {
    return !!(selectedSourceOrg.value && org.id === selectedSourceOrg.value.id);
}

const transformResults = computed(() =>
    pipeline.transformStatus.summary?.results || pipeline.transformStatus.progress?.results || [],
);
const loadResults = computed(() =>
    pipeline.loadStatus.summary?.results || pipeline.loadStatus.progress?.results || [],
);

const transformProgress = computed(() => {
    if (pipeline.transformStatus.status === 'complete') return 100;
    const p = pipeline.transformStatus.progress;
    if (!p || !p.total) return 0;
    return Math.round((p.completed / p.total) * 100);
});
const loadProgress = computed(() => {
    if (pipeline.loadStatus.status === 'complete') return 100;
    const p = pipeline.loadStatus.progress;
    if (!p || !p.total) return 0;
    return Math.round((p.completed / p.total) * 100);
});

const loadLoadedTotal = computed(() => loadResults.value.reduce((s, r) => s + (r.loaded || 0), 0));
const loadFailedTotal = computed(() => loadResults.value.reduce((s, r) => s + (r.failed || 0), 0));

const loadRunId = computed(() => pipeline.loadStatus.summary?.runId || null);

const overallStatusLabel = computed(() => {
    if (running.value) return currentStage.value === 'load' ? 'Loading…' : 'Transforming…';
    if (currentStage.value === 'complete') return 'Completed';
    if (currentStage.value === 'failed') return 'Failed';
    return 'Ready';
});
const overallStatusSeverity = computed(() => {
    if (running.value) return 'info';
    if (currentStage.value === 'complete') return 'success';
    if (currentStage.value === 'failed') return 'danger';
    return 'secondary';
});

function stageLabel(status) {
    return { idle: 'Idle', running: 'Running', complete: 'Complete', failed: 'Failed', auth_failed: 'Auth Required' }[status] || status;
}
function stageSeverity(status) {
    return { idle: 'secondary', running: 'info', complete: 'success', failed: 'danger', auth_failed: 'warn' }[status] || 'secondary';
}
function resultSeverity(status) {
    return { success: 'success', skipped: 'warn', failed: 'danger' }[status] || 'secondary';
}

async function onOrgsReady() {
    pipeline.reset();
    if (!bothOrgsAnalyzed.value) return;
    try {
        await pipeline.fetchLoadPlan(sourceOrgId.value, targetOrgId.value);
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Load plan', detail: pipeline.error || 'Failed to load plan', life: 5000 });
    }
    await resumeIfRunning(sourceOrgId.value, targetOrgId.value);
}

function onOrgChange() {
    saveMigrationSelection({ sourceOrgId: sourceOrgId.value, targetOrgId: targetOrgId.value });
    stopPolling();
    onOrgsReady();
}

async function onRunMigration() {
    if (!bothOrgsAnalyzed.value) return;
    await runMigration(sourceOrgId.value, targetOrgId.value);
}

async function onRunExtraction() {
    if (!sourceOrgId.value) return;
    await runExtraction(sourceOrgId.value);
}

function onTracebackChange() {
    // Selection persisted by the component; nothing else required here.
}

async function downloadCsv(objectName, type) {
    if (!loadRunId.value) return;
    try {
        await pipeline.downloadLoadCsv(targetOrgId.value, loadRunId.value, objectName, type);
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Download failed', detail: e.message || 'CSV not available', life: 5000 });
    }
}

function viewErrors(objectName) {
    errorObjectName.value = objectName;
    showErrorDialog.value = true;
}

onMounted(async () => {
    await orgStore.loadOrgs();
    const { source, target } = route.query;
    const saved = loadMigrationSelection();
    selectedSourceOrg.value = findOrgById(orgs.value, source || saved.sourceOrgId);
    selectedTargetOrg.value = findOrgById(orgs.value, target || saved.targetOrgId);
    saveMigrationSelection({ sourceOrgId: sourceOrgId.value, targetOrgId: targetOrgId.value });
    if (bothOrgsAnalyzed.value) await onOrgsReady();
});

onUnmounted(() => {
    stopPolling();
});
</script>

<style scoped>
.pipeline-view {
    padding: 2rem;
    max-width: 1600px;
    margin: 0 auto;
}

.pipeline-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.header-titles h1 {
    font-size: 1.75rem;
    margin: 0;
}

.subtitle {
    color: var(--text-color-secondary);
    margin: 0.25rem 0 0;
}

.header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.org-selector-section {
    display: flex;
    align-items: center;
    gap: 2rem;
    margin-bottom: 1.5rem;
    padding: 1.5rem;
    background: var(--surface-card);
    border-radius: 12px;
    border: 1px solid var(--surface-border);
}

.org-selector {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.org-selector label {
    font-weight: 600;
    font-size: 0.85rem;
}

.org-arrow {
    color: var(--text-color-secondary);
    font-size: 1.25rem;
    margin-top: 1.5rem;
}

.org-status-message :deep(.p-message) {
    margin: 0.25rem 0 0;
}

.empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-color-secondary);
}

.empty-state i {
    font-size: 2.5rem;
    display: block;
    margin-bottom: 1rem;
    opacity: 0.5;
}

.stage-strip {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
}

.stage-card {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.stage-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.stage-name {
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.stage-card-body {
    min-height: 3.5rem;
}

.stage-current {
    font-size: 0.9rem;
    margin: 0 0 0.5rem;
    font-weight: 500;
}

.stage-count,
.stage-summary,
.stage-hint {
    font-size: 0.85rem;
    color: var(--text-color-secondary);
    margin: 0.25rem 0 0;
}

.prereq-note {
    margin-bottom: 1.5rem;
}

.section-card {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
}

.section-head {
    margin-bottom: 1rem;
}

.section-head h2 {
    font-size: 1.2rem;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.section-sub {
    color: var(--text-color-secondary);
    font-size: 0.85rem;
}

.deferred-block {
    margin-top: 1.5rem;
}

.deferred-block h3 {
    font-size: 1rem;
    margin: 0 0 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.row-actions {
    display: flex;
    gap: 0.25rem;
}

.error-cell {
    color: var(--red-500, #ef4444);
    font-size: 0.85rem;
    white-space: pre-wrap;
    word-break: break-word;
}
</style>
