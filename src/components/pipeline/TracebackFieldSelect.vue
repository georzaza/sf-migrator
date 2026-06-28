<script setup>
/**
 * TracebackFieldSelect — Dropdown to choose the target External-Id field used to
 * trace records back to their source (deferred-field resolution + idempotent
 * upserts). Loads candidate unique/External-Id fields for the target object and
 * the currently-selected value, and persists changes immediately.
 *
 * Props:
 *   sourceObjectId  - id of the source object in the pair
 *   targetObjectId  - id of the target object (candidates are loaded for this)
 *   autoSave        - persist immediately on change (default true). When false the
 *                     parent owns persistence (e.g. a dialog Save button).
 *   disabled        - disable the control
 *   showWarnings    - render advisory messages (default true)
 *
 * Emits:
 *   change          - (field | null) the newly selected candidate, or null when cleared
 *   update:modelValue - (fieldId | null) selected field id, for v-model use
 */
import { ref, watch, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { usePipelineStore } from '@/stores/pipelineStore';

const props = defineProps({
    sourceObjectId: { type: [String, Number], default: null },
    targetObjectId: { type: [String, Number], default: null },
    autoSave: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    showWarnings: { type: Boolean, default: true },
});

const emit = defineEmits(['change', 'update:modelValue']);

const store = usePipelineStore();
const toast = useToast();

const candidates = ref([]);
const selectedId = ref(null);
const loading = ref(false);
const saving = ref(false);

const options = computed(() =>
    candidates.value.map((c) => ({
        ...c,
        displayLabel: c.label && c.label !== c.name ? `${c.label} (${c.name})` : c.name,
    })),
);

const hasCandidates = computed(() => candidates.value.length > 0);

async function load() {
    if (!props.targetObjectId) {
        candidates.value = [];
        selectedId.value = null;
        return;
    }
    loading.value = true;
    try {
        const [cands, selected] = await Promise.all([
            store.fetchTracebackCandidates(props.targetObjectId),
            props.sourceObjectId
                ? store.fetchSelectedTracebackField(props.sourceObjectId, props.targetObjectId)
                : Promise.resolve(null),
        ]);
        candidates.value = cands;
        selectedId.value = selected?.id ?? null;
        emit('update:modelValue', selectedId.value);
    } catch (err) {
        console.error('Failed to load traceback candidates:', err);
        candidates.value = [];
        selectedId.value = null;
    } finally {
        loading.value = false;
    }
}

async function onChange(event) {
    const fieldId = event.value ?? null;
    selectedId.value = fieldId;
    const field = candidates.value.find((c) => c.id === fieldId) || null;
    emit('update:modelValue', fieldId);

    if (!props.autoSave) {
        emit('change', field);
        return;
    }
    if (!props.sourceObjectId || !props.targetObjectId) return;
    saving.value = true;
    try {
        const saved = await store.saveTracebackField(props.sourceObjectId, props.targetObjectId, fieldId);
        toast.add({
            severity: 'success',
            summary: 'External-Id updated',
            detail: saved?.name ? `Set to ${saved.name}` : 'Cleared',
            life: 3000,
        });
        emit('change', saved);
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Failed to save External-Id',
            detail: err.response?.data?.message || err.message || 'Unknown error',
            life: 5000,
        });
    } finally {
        saving.value = false;
    }
}

watch(
    () => [props.sourceObjectId, props.targetObjectId],
    () => load(),
    { immediate: true },
);
</script>

<template>
    <div class="traceback-select">
        <Dropdown
            :modelValue="selectedId"
            :options="options"
            optionLabel="displayLabel"
            optionValue="id"
            :loading="loading || saving"
            :disabled="disabled || loading || !hasCandidates"
            placeholder="Select External-Id field"
            showClear
            filter
            class="w-full"
            @change="onChange"
        >
            <template #option="slotProps">
                <div class="flex items-center justify-between gap-2">
                    <span>{{ slotProps.option.displayLabel }}</span>
                    <Tag v-if="slotProps.option.unique" value="Unique" severity="info" />
                </div>
            </template>
        </Dropdown>

        <template v-if="showWarnings">
            <Message v-if="!loading && !hasCandidates" severity="warn" :closable="false" class="hint">
                No unique / External-Id fields available on the target object.
            </Message>
            <Message v-else-if="!loading && !selectedId" severity="warn" :closable="false" class="hint">
                No External-Id selected — this object will be skipped during load.
            </Message>
        </template>
    </div>
</template>

<style scoped>
.traceback-select {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 14rem;
}

.hint {
    margin: 0;
}
</style>
