<script setup>
/**
 * LoadErrorDialog — Shows per-record load outcomes (from the stg3 load table) for
 * a single target object, with status filtering and pagination. Used to inspect
 * why specific records failed or were skipped during load.
 *
 * Props:
 *   visible           - dialog visibility (v-model:visible)
 *   targetOrgId       - target org id
 *   targetObjectName  - target object API name
 *   objectLabel       - display label for the header (optional)
 *
 * Emits:
 *   update:visible
 */
import { ref, watch } from 'vue';
import { usePipelineStore } from '@/stores/pipelineStore';

const props = defineProps({
    visible: { type: Boolean, default: false },
    targetOrgId: { type: [String, Number], default: null },
    targetObjectName: { type: String, default: null },
    objectLabel: { type: String, default: null },
});

const emit = defineEmits(['update:visible']);

const store = usePipelineStore();

const records = ref([]);
const runId = ref(null);
const loading = ref(false);
const statusFilter = ref('failed');

const statusOptions = [
    { label: 'Failed', value: 'failed' },
    { label: 'Skipped', value: 'skipped' },
    { label: 'All', value: 'all' },
];

async function load() {
    if (!props.targetOrgId || !props.targetObjectName) return;
    loading.value = true;
    try {
        const data = await store.fetchLoadRecords(props.targetOrgId, props.targetObjectName, statusFilter.value);
        records.value = data.records || [];
        runId.value = data.runId || null;
    } catch (err) {
        console.error('Failed to load records:', err);
        records.value = [];
    } finally {
        loading.value = false;
    }
}

function statusSeverity(status) {
    if (status === 'loaded') return 'success';
    if (status === 'failed') return 'danger';
    if (status && status.startsWith('skipped')) return 'warn';
    return 'secondary';
}

watch(
    () => props.visible,
    (isOpen) => {
        if (isOpen) {
            statusFilter.value = 'failed';
            load();
        }
    },
);

watch(statusFilter, () => {
    if (props.visible) load();
});
</script>

<template>
    <Dialog
        :visible="visible"
        :header="`Load results — ${objectLabel || targetObjectName || ''}`"
        modal
        dismissableMask
        :style="{ width: '60rem', maxWidth: '95vw' }"
        @update:visible="(v) => emit('update:visible', v)"
    >
        <div class="dialog-toolbar">
            <span class="run-id" v-if="runId">Run: {{ runId }}</span>
            <Dropdown
                v-model="statusFilter"
                :options="statusOptions"
                optionLabel="label"
                optionValue="value"
                class="status-filter"
            />
        </div>

        <DataTable
            :value="records"
            :loading="loading"
            paginator
            :rows="10"
            :rowsPerPageOptions="[10, 25, 50]"
            scrollable
            scrollHeight="50vh"
            size="small"
        >
            <template #empty>
                <span>No records found for this filter.</span>
            </template>

            <Column field="__srcId" header="Source Id" style="min-width: 11rem" />
            <Column field="__srcObject" header="Source Object" style="min-width: 9rem" />
            <Column header="Status" style="min-width: 8rem">
                <template #body="{ data }">
                    <Tag :value="data.__status" :severity="statusSeverity(data.__status)" />
                </template>
            </Column>
            <Column field="__targetId" header="Target Id" style="min-width: 11rem" />
            <Column field="__error" header="Error" style="min-width: 18rem">
                <template #body="{ data }">
                    <span class="error-cell">{{ data.__error }}</span>
                </template>
            </Column>
        </DataTable>
    </Dialog>
</template>

<style scoped>
.dialog-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
}

.run-id {
    font-size: 0.8rem;
    color: var(--text-color-secondary);
    font-family: monospace;
}

.status-filter {
    min-width: 10rem;
}

.error-cell {
    color: var(--red-500, #ef4444);
    font-size: 0.85rem;
    white-space: pre-wrap;
    word-break: break-word;
}
</style>
