<script setup>
/**
 * UpsertConfigSelect — select the operation type and, for upsert, the target
 * External ID field that Salesforce will use to match existing records.
 *
 * Props:
 *   sourceObjectId  - source object id
 *   targetObjectId  - target object id
 *   autoSave        - persist immediately on change (default true)
 *   disabled        - disable the control
 *
 * Emits:
 *   change  - ({ operation, externalIdFieldId, externalIdFieldName }) on any change
 */
import { ref, watch, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { usePipelineStore } from '@/stores/pipelineStore';

const props = defineProps({
    sourceObjectId: { type: [String, Number], default: null },
    targetObjectId: { type: [String, Number], default: null },
    autoSave: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['change']);

const store = usePipelineStore();
const toast = useToast();

const OPERATION_OPTIONS = [
    { label: 'Upsert (default)', value: 'upsert', description: 'Create new records or update existing ones via External ID' },
    { label: 'Insert', value: 'insert', description: 'Always create new records' },
];

const operation = ref('upsert');
const externalIdFieldId = ref(null);
const externalIdCandidates = ref([]);
const loading = ref(false);
const saving = ref(false);

const isUpsert = computed(() => operation.value === 'upsert');

const fieldOptions = computed(() =>
    externalIdCandidates.value.map((f) => ({
        ...f,
        displayLabel: f.label && f.label !== f.name ? `${f.label} (${f.name})` : f.name,
    })),
);

const selectedField = computed(() =>
    fieldOptions.value.find((f) => f.id === externalIdFieldId.value) || null,
);

const noExternalIdFields = computed(() =>
    isUpsert.value && externalIdCandidates.value.length === 0 && !loading.value,
);

const missingExternalId = computed(() =>
    isUpsert.value && !externalIdFieldId.value && !loading.value && externalIdCandidates.value.length > 0,
);

async function load() {
    if (!props.targetObjectId) {
        externalIdCandidates.value = [];
        externalIdFieldId.value = null;
        operation.value = 'upsert';
        return;
    }
    loading.value = true;
    try {
        const config = await store.fetchUpsertConfig(
            props.targetObjectId,
            props.sourceObjectId || undefined,
        );
        externalIdCandidates.value = config.externalIdCandidates || [];
        operation.value = config.operation || 'upsert';
        externalIdFieldId.value = config.upsertExternalId?.id || null;
    } catch (err) {
        console.error('Failed to load upsert config:', err);
    } finally {
        loading.value = false;
    }
}

function currentSelection() {
    return {
        operation: operation.value,
        externalIdFieldId: isUpsert.value ? externalIdFieldId.value : null,
        externalIdFieldName: isUpsert.value ? (selectedField.value?.name || null) : null,
    };
}

async function persistChange() {
    const selection = currentSelection();
    emit('change', selection);
    if (!props.autoSave || !props.sourceObjectId || !props.targetObjectId) return;

    // Don't auto-save an incomplete upsert config — wait for user to pick the field too
    if (isUpsert.value && !externalIdFieldId.value) return;

    saving.value = true;
    try {
        await store.saveUpsertConfig(props.sourceObjectId, props.targetObjectId, {
            operation: selection.operation,
            externalIdFieldId: selection.externalIdFieldId,
        });
        toast.add({
            severity: 'success',
            summary: 'Saved',
            detail: selection.operation === 'upsert'
                ? `Upsert with External ID: ${selection.externalIdFieldName}`
                : 'Insert (create new records)',
            life: 3000,
        });
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Failed to save',
            detail: err.response?.data?.message || err.message || 'Unknown error',
            life: 5000,
        });
    } finally {
        saving.value = false;
    }
}

function onOperationChange() {
    // When switching to Insert, clear the External ID selection
    if (!isUpsert.value) {
        externalIdFieldId.value = null;
    }
    persistChange();
}

function onFieldChange() {
    persistChange();
}

watch(
    () => [props.sourceObjectId, props.targetObjectId],
    () => load(),
    { immediate: true },
);
</script>

<template>
    <div class="upsert-config-select">
        <!-- Operation selection -->
        <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-surface-700 dark:text-surface-200">Operation</label>
            <Select
                v-model="operation"
                :options="OPERATION_OPTIONS"
                optionLabel="label"
                optionValue="value"
                :disabled="disabled || loading"
                :loading="loading"
                class="w-full"
                @change="onOperationChange"
            >
                <template #option="slotProps">
                    <div class="flex flex-col">
                        <span class="font-medium">{{ slotProps.option.label }}</span>
                        <span class="text-xs text-surface-500">{{ slotProps.option.description }}</span>
                    </div>
                </template>
            </Select>
        </div>

        <!-- External ID field selection (upsert only) -->
        <template v-if="isUpsert">
            <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-surface-700 dark:text-surface-200">
                    External ID Field
                    <span class="text-red-500 ml-1">*</span>
                </label>
                <Select
                    v-model="externalIdFieldId"
                    :options="fieldOptions"
                    optionLabel="displayLabel"
                    optionValue="id"
                    :loading="loading || saving"
                    :disabled="disabled || loading || noExternalIdFields"
                    placeholder="Select External ID field"
                    showClear
                    filter
                    class="w-full"
                    @change="onFieldChange"
                />
            </div>
        </template>

        <!-- Warnings -->
        <Message v-if="noExternalIdFields" severity="warn" :closable="false" class="hint">
            No External ID fields found on this target object. Mark a field as External ID in Salesforce, then re-analyze the org.
        </Message>
        <Message v-if="missingExternalId" severity="warn" :closable="false" class="hint">
            Select an External ID field — required for upsert. This object will be skipped during migration until one is selected.
        </Message>
    </div>
</template>

<style scoped>
.upsert-config-select {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 16rem;
}

.hint {
    margin: 0;
}
</style>
