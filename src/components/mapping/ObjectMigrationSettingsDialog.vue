<script setup>
/**
 * ObjectMigrationSettingsDialog - Configure per-object-pair migration settings.
 *
 * Props:
 *   visible           - Controls dialog visibility (v-model:visible)
 *   sourceObjectId    - Source object metadata id
 *   targetObjectId    - Target object metadata id
 *   sourceObjectLabel - Source object label (for the header)
 *   targetObjectLabel - Target object label (for the header)
 *
 * Emits:
 *   update:visible - v-model for visibility
 *   saved          - After a successful save
 */
import { ref, watch, computed } from 'vue';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useToast } from 'primevue/usetoast';
import TracebackFieldSelect from '@/components/pipeline/TracebackFieldSelect.vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false,
    },
    sourceObjectId: {
        type: String,
        default: null,
    },
    targetObjectId: {
        type: String,
        default: null,
    },
    sourceObjectLabel: {
        type: String,
        default: '',
    },
    targetObjectLabel: {
        type: String,
        default: '',
    },
});

const emit = defineEmits(['update:visible', 'saved']);

const settingsStore = useSettingsStore();
const pipelineStore = usePipelineStore();
const toast = useToast();

const operationOptions = [
    { label: 'Insert', value: 'insert' },
    { label: 'Upsert', value: 'upsert' },
    { label: 'Update', value: 'update' },
];

const defaultForm = () => ({
    enabled: true,
    operation: 'insert',
    batchSize: 200,
    useBulkApi: true,
    sortToAvoidLocks: false,
    extractFilter: '',
});

const form = ref(defaultForm());
const saving = ref(false);
const errorMessage = ref('');
// undefined = user has not changed the External-Id in this dialog session.
const pendingTracebackFieldId = ref(undefined);

const dialogHeader = computed(() => {
    const src = props.sourceObjectLabel || 'Source';
    const tgt = props.targetObjectLabel || 'Target';
    return `Migration Settings: ${src} → ${tgt}`;
});

watch(() => props.visible, async (val) => {
    if (!val) return;

    errorMessage.value = '';
    form.value = defaultForm();
    pendingTracebackFieldId.value = undefined;

    if (!props.sourceObjectId || !props.targetObjectId) return;

    try {
        const setting = await settingsStore.loadSetting(props.sourceObjectId, props.targetObjectId);
        if (setting) {
            form.value = {
                enabled: setting.enabled ?? true,
                operation: setting.operation ?? 'insert',
                batchSize: setting.batchSize ?? 200,
                useBulkApi: setting.useBulkApi ?? true,
                sortToAvoidLocks: setting.sortToAvoidLocks ?? false,
                extractFilter: setting.extractFilter ?? '',
            };
        }
    } catch (error) {
        errorMessage.value = error.response?.data?.message || error.message || 'Failed to load settings';
    }
});

function onClose() {
    emit('update:visible', false);
}

function onTracebackChange(field) {
    pendingTracebackFieldId.value = field?.id ?? null;
}

async function onSave() {
    if (!props.sourceObjectId || !props.targetObjectId) return;

    saving.value = true;
    errorMessage.value = '';

    try {
        const payload = {
            enabled: form.value.enabled,
            operation: form.value.operation,
            batchSize: form.value.batchSize,
            useBulkApi: form.value.useBulkApi,
            sortToAvoidLocks: form.value.sortToAvoidLocks,
            extractFilter: form.value.extractFilter?.trim() ? form.value.extractFilter.trim() : null,
        };

        await settingsStore.saveSetting(props.sourceObjectId, props.targetObjectId, payload);
        if (pendingTracebackFieldId.value !== undefined) {
            await pipelineStore.saveTracebackField(props.sourceObjectId, props.targetObjectId, pendingTracebackFieldId.value);
        }
        toast.add({ severity: 'success', summary: 'Saved', detail: 'Migration settings saved', life: 3000 });
        emit('saved');
        onClose();
    } catch (error) {
        errorMessage.value = error.response?.data?.message || error.message || 'Failed to save settings';
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Dialog
        :visible="visible"
        @update:visible="emit('update:visible', $event)"
        :header="dialogHeader"
        modal
        dismissableMask
        :style="{ width: '480px' }"
    >
        <Message v-if="errorMessage" severity="error" :closable="false" class="mb-3">
            {{ errorMessage }}
        </Message>

        <form class="settings-form" @submit.prevent="onSave">
            <div class="field-row checkbox-row">
                <Checkbox v-model="form.enabled" :binary="true" inputId="setting-enabled" />
                <label for="setting-enabled">Include this object pair in migration</label>
            </div>

            <div class="field-row">
                <label for="setting-operation">Operation</label>
                <Dropdown
                    id="setting-operation"
                    v-model="form.operation"
                    :options="operationOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full"
                />
            </div>

            <div class="field-row">
                <label>Traceback External-Id field</label>
                <TracebackFieldSelect
                    :sourceObjectId="sourceObjectId"
                    :targetObjectId="targetObjectId"
                    :autoSave="false"
                    @change="onTracebackChange"
                />
                <small class="field-hint">
                    Unique field on the target used to trace records back to the source and resolve lookups. Saved with this dialog.
                </small>
            </div>

            <div class="field-row">
                <label for="setting-batch">Batch Size</label>
                <InputNumber
                    id="setting-batch"
                    v-model="form.batchSize"
                    :min="1"
                    :max="10000"
                    showButtons
                    class="w-full"
                />
            </div>

            <div class="field-row checkbox-row">
                <Checkbox v-model="form.useBulkApi" :binary="true" inputId="setting-bulk" />
                <label for="setting-bulk">Use Bulk API</label>
            </div>

            <div class="field-row checkbox-row">
                <Checkbox v-model="form.sortToAvoidLocks" :binary="true" inputId="setting-sort" />
                <label for="setting-sort">Sort records to avoid row locks</label>
            </div>

            <div class="field-row">
                <label for="setting-filter">Extract Filter (optional WHERE clause)</label>
                <Textarea
                    id="setting-filter"
                    v-model="form.extractFilter"
                    rows="2"
                    placeholder="e.g. IsActive = true"
                    class="w-full"
                />
            </div>
        </form>

        <template #footer>
            <Button label="Cancel" icon="pi pi-times" text @click="onClose" />
            <Button label="Save" icon="pi pi-check" :loading="saving" @click="onSave" />
        </template>
    </Dialog>
</template>

<style scoped>
.settings-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.field-row {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.field-row.checkbox-row {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
}

.field-hint {
    color: var(--text-color-secondary);
    font-size: 0.8rem;
}

.w-full {
    width: 100%;
}

.mb-3 {
    margin-bottom: 0.75rem;
}
</style>
