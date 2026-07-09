<script setup>
/**
 * TracebackFieldSelect — pick the strategy + field(s) used to trace a source
 * record to its target counterpart after load.
 *
 * Two modes (toggle):
 *  - Single field: a grouped dropdown listing tier-1 (External Id), tier-2
 *    (Unique), and tier-3 (Alphanumeric, length >= 18) candidates. The chosen
 *    field receives the SOURCE record Id at load time (overrides any user
 *    mapping for it — a warning is shown when that happens).
 *  - Composite: a multi-select of any updateable target field. The user picks
 *    2+ fields whose tuple uniquely identifies a target record. Field values
 *    are inserted as the user mapped them; no override.
 *
 * Props:
 *   sourceObjectId  - source object id
 *   targetObjectId  - target object id
 *   autoSave        - persist immediately on change (default true)
 *   disabled        - disable the control
 *   showWarnings    - render advisory messages (default true)
 *
 * Emits:
 *   change          - ({ strategy, fields }) the newly selected configuration
 *                     ({ strategy: null, fields: [] } when cleared)
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

const emit = defineEmits(['change']);

const store = usePipelineStore();
const toast = useToast();

const candidates = ref({ external: [], unique: [], alphanumeric: [], composite: [], mappedTargetFieldNames: [] });
const mappedTargetFieldNames = computed(() => new Set(candidates.value.mappedTargetFieldNames || []));

// Local state.
const useComposite = ref(false);
const singleFieldId = ref(null);          // currently selected single-field id
const compositeFieldIds = ref([]);        // selected composite field ids
const loading = ref(false);
const saving = ref(false);

// Build grouped options for the single-field dropdown (PrimeVue grouped Dropdown).
const groupedSingleOptions = computed(() => {
    const groups = [];
    if (candidates.value.external.length) {
        groups.push({ label: 'External Id (recommended)', items: candidates.value.external.map(decorate) });
    }
    if (candidates.value.unique.length) {
        groups.push({ label: 'Unique fields', items: candidates.value.unique.map(decorate) });
    }
    if (candidates.value.alphanumeric.length) {
        groups.push({ label: 'Alphanumeric (length >= 18)', items: candidates.value.alphanumeric.map(decorate) });
    }
    return groups;
});

const compositeOptions = computed(() => (candidates.value.composite || []).map(decorate));

const hasSingleFieldOptions = computed(() => groupedSingleOptions.value.length > 0);

const selectedSingleField = computed(() => {
    if (!singleFieldId.value) return null;
    for (const group of groupedSingleOptions.value) {
        const f = group.items.find((it) => it.id === singleFieldId.value);
        if (f) return f;
    }
    return null;
});

const selectedCompositeFields = computed(() =>
    compositeOptions.value.filter((f) => compositeFieldIds.value.includes(f.id)),
);

const overrideWarningField = computed(() => {
    if (useComposite.value || !selectedSingleField.value) return null;
    return mappedTargetFieldNames.value.has(selectedSingleField.value.name) ? selectedSingleField.value : null;
});

const compositeError = computed(() => {
    if (!useComposite.value) return null;
    if (compositeFieldIds.value.length < 2) {
        return 'Pick 2 or more fields whose combined values uniquely identify a target record.';
    }
    return null;
});

function decorate(f) {
    return {
        ...f,
        displayLabel: f.label && f.label !== f.name ? `${f.label} (${f.name})` : f.name,
    };
}

function currentSelection() {
    if (useComposite.value) {
        if (compositeFieldIds.value.length < 2) return { strategy: null, fields: [] };
        return {
            strategy: 'composite',
            fields: selectedCompositeFields.value.map((f) => ({ id: f.id, name: f.name })),
            tier: 'composite',
        };
    }
    if (!singleFieldId.value || !selectedSingleField.value) return { strategy: null, fields: [] };
    return {
        strategy: selectedSingleField.value.tier, // 'external-id' | 'unique' | 'alphanumeric'
        fields: [{ id: selectedSingleField.value.id, name: selectedSingleField.value.name }],
        tier: selectedSingleField.value.tier,
    };
}

async function load() {
    if (!props.targetObjectId) {
        candidates.value = { external: [], unique: [], alphanumeric: [], composite: [], mappedTargetFieldNames: [] };
        singleFieldId.value = null;
        compositeFieldIds.value = [];
        useComposite.value = false;
        return;
    }
    loading.value = true;
    try {
        const [cands, current] = await Promise.all([
            store.fetchTracebackCandidates(props.targetObjectId, props.sourceObjectId || undefined),
            props.sourceObjectId
                ? store.fetchTraceback(props.sourceObjectId, props.targetObjectId)
                : Promise.resolve({ strategy: null, fields: [] }),
        ]);
        candidates.value = cands;
        if (current.strategy === 'composite') {
            useComposite.value = true;
            compositeFieldIds.value = (current.fields || []).map((f) => f.id);
            singleFieldId.value = null;
        } else if (current.strategy && current.fields?.length) {
            useComposite.value = false;
            singleFieldId.value = current.fields[0].id;
            compositeFieldIds.value = [];
        } else {
            useComposite.value = false;
            singleFieldId.value = null;
            compositeFieldIds.value = [];
        }
    } catch (err) {
        console.error('Failed to load traceback config:', err);
    } finally {
        loading.value = false;
    }
}

async function persistChange() {
    const selection = currentSelection();
    emit('change', selection);
    if (!props.autoSave) return;
    if (!props.sourceObjectId || !props.targetObjectId) return;
    // Don't auto-save partial composite selections.
    if (useComposite.value && compositeFieldIds.value.length < 2) return;
    saving.value = true;
    try {
        const body = selection.strategy
            ? { strategy: selection.strategy, fieldIds: selection.fields.map((f) => f.id) }
            : null;
        const saved = await store.saveTraceback(props.sourceObjectId, props.targetObjectId, body);
        toast.add({
            severity: 'success',
            summary: 'Traceback saved',
            detail: saved.strategy
                ? `${formatStrategy(saved.strategy)}: ${saved.fields.map((f) => f.name).join(', ')}`
                : 'Cleared',
            life: 3000,
        });
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Failed to save traceback',
            detail: err.response?.data?.message || err.message || 'Unknown error',
            life: 5000,
        });
    } finally {
        saving.value = false;
    }
}

function formatStrategy(s) {
    if (s === 'external-id') return 'External Id';
    if (s === 'unique') return 'Unique field';
    if (s === 'alphanumeric') return 'Alphanumeric field';
    if (s === 'composite') return 'Composite';
    return s;
}

function onToggleComposite() {
    // Reset the other side's selection so we don't keep stale state.
    if (useComposite.value) {
        singleFieldId.value = null;
    } else {
        compositeFieldIds.value = [];
    }
    persistChange();
}

function onSingleChange() { persistChange(); }
function onCompositeChange() { persistChange(); }

watch(
    () => [props.sourceObjectId, props.targetObjectId],
    () => load(),
    { immediate: true },
);
</script>

<template>
    <div class="traceback-select">
        <div class="mode-row">
            <Checkbox
                v-model="useComposite"
                :binary="true"
                inputId="traceback-composite-toggle"
                :disabled="disabled || loading"
                @change="onToggleComposite"
            />
            <label for="traceback-composite-toggle">Use a combination of fields (composite key)</label>
        </div>

        <!-- Single field mode -->
        <template v-if="!useComposite">
            <Dropdown
                v-model="singleFieldId"
                :options="groupedSingleOptions"
                optionLabel="displayLabel"
                optionValue="id"
                optionGroupLabel="label"
                optionGroupChildren="items"
                :loading="loading || saving"
                :disabled="disabled || loading || !hasSingleFieldOptions"
                placeholder="Select a single traceback field"
                showClear
                filter
                class="w-full"
                @change="onSingleChange"
            >
                <template #option="slotProps">
                    <div class="flex items-center justify-between gap-2">
                        <span>{{ slotProps.option.displayLabel }}</span>
                        <Tag v-if="slotProps.option.unique" value="Unique" severity="info" />
                    </div>
                </template>
            </Dropdown>
        </template>

        <!-- Composite mode -->
        <template v-else>
            <MultiSelect
                v-model="compositeFieldIds"
                :options="compositeOptions"
                optionLabel="displayLabel"
                optionValue="id"
                :loading="loading || saving"
                :disabled="disabled || loading"
                placeholder="Pick 2 or more fields"
                filter
                display="chip"
                class="w-full"
                @change="onCompositeChange"
            />
        </template>

        <template v-if="showWarnings">
            <Message v-if="!loading && !useComposite && !hasSingleFieldOptions" severity="warn" :closable="false" class="hint">
                No External-Id, Unique, or Alphanumeric (length >= 18) fields on the target. Use a composite key instead.
            </Message>
            <Message v-if="overrideWarningField" severity="warn" :closable="false" class="hint">
                Field <strong>{{ overrideWarningField.name }}</strong> is also user-mapped — the load will OVERRIDE the mapped value with the source record Id.
            </Message>
            <Message v-if="compositeError" severity="warn" :closable="false" class="hint">
                {{ compositeError }}
            </Message>
            <Message
                v-if="!loading && !useComposite && !singleFieldId && hasSingleFieldOptions"
                severity="warn" :closable="false" class="hint"
            >
                No traceback selected — this object will be skipped during load.
            </Message>
        </template>
    </div>
</template>

<style scoped>
.traceback-select {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 14rem;
}

.mode-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.hint {
    margin: 0;
}
</style>
