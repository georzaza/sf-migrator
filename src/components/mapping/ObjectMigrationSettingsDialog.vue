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
import { useMetadataStore } from '@/stores/metadataStore';
import { useToast } from 'primevue/usetoast';
import UpsertConfigSelect from '@/components/pipeline/UpsertConfigSelect.vue';

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
const metadataStore = useMetadataStore();
const toast = useToast();

const defaultForm = () => ({
    batchSize: 200,
    sortToAvoidLocks: false,
    referenceStrategy: 'id-map',
    sourceField: null,
    targetField: null,
    normalizer: 'none',
});

const form = ref(defaultForm());
const saving = ref(false);
const errorMessage = ref('');
const loading = ref(true);
const loaded = ref(false);
// undefined = user has not changed the upsert config in this dialog session.
const pendingUpsertConfig = ref(undefined);

const strategyOptions = [
    { label: 'Use migrated record IDs (default)', value: 'id-map' },
    { label: 'Match existing target records', value: 'match-existing' },
];
const normalizerOptions = [
    { label: 'None (exact match)', value: 'none' },
    { label: 'Local part (before @)', value: 'localPart' },
    { label: 'Lowercase', value: 'lowercase' },
    { label: 'Local part + lowercase', value: 'localPartLowercase' },
];
const sourceFields = computed(() => metadataStore.getFields(props.sourceObjectId));
const targetFields = computed(() => metadataStore.getFields(props.targetObjectId));
const matchExisting = computed(() => form.value.referenceStrategy === 'match-existing');
const canSave = computed(() =>
    props.visible && props.sourceObjectId && props.targetObjectId &&
    loaded.value && !loading.value && !saving.value &&
    (!matchExisting.value || (
        sourceFields.value.some(field => field.name === form.value.sourceField) &&
        targetFields.value.some(field => field.name === form.value.targetField) &&
        normalizerOptions.some(option => option.value === form.value.normalizer)
    )),
);

const dialogHeader = computed(() => {
    const src = props.sourceObjectLabel || 'Source';
    const tgt = props.targetObjectLabel || 'Target';
    return `Migration Settings: ${src} → ${tgt}`;
});

watch(() => [props.visible, props.sourceObjectId, props.targetObjectId], async ([visible, sourceObjectId, targetObjectId], _, onCleanup) => {
    let cancelled = false;
    onCleanup(() => { cancelled = true; });
    loaded.value = false;
    loading.value = true;
    if (!visible) return;

    errorMessage.value = '';
    form.value = defaultForm();
    pendingUpsertConfig.value = undefined;

    if (!sourceObjectId || !targetObjectId) return;

    try {
        const [setting] = await Promise.all([
            settingsStore.loadSetting(sourceObjectId, targetObjectId),
            metadataStore.loadFields(sourceObjectId),
            metadataStore.loadFields(targetObjectId),
        ]);
        if (cancelled) return;
        if (setting) {
            const referenceResolution = setting.metadata?.referenceResolution;
            form.value = {
                batchSize: setting.batchSize ?? 200,
                sortToAvoidLocks: setting.sortToAvoidLocks ?? false,
                referenceStrategy: referenceResolution?.strategy ?? 'id-map',
                sourceField: referenceResolution?.sourceField ?? null,
                targetField: referenceResolution?.targetField ?? null,
                normalizer: referenceResolution?.normalizer ?? 'none',
            };
        }
        loaded.value = true;
    } catch (error) {
        if (cancelled) return;
        errorMessage.value = error.response?.data?.message || error.message || 'Failed to load settings';
    } finally {
        if (!cancelled) loading.value = false;
    }
}, { immediate: true });

function onClose() {
    emit('update:visible', false);
}

function onUpsertConfigChange(config) {
    // config = { operation, externalIdFieldId, externalIdFieldName }
    pendingUpsertConfig.value = config;
}

async function onSave() {
    if (!canSave.value) return;

    const sourceObjectId = props.sourceObjectId;
    const targetObjectId = props.targetObjectId;
    const upsertConfig = matchExisting.value ? undefined : pendingUpsertConfig.value;
    saving.value = true;
    errorMessage.value = '';

    try {
        const payload = {
            batchSize: form.value.batchSize,
            sortToAvoidLocks: form.value.sortToAvoidLocks,
            referenceResolution: matchExisting.value ? {
                strategy: 'match-existing',
                sourceField: form.value.sourceField,
                targetField: form.value.targetField,
                normalizer: form.value.normalizer,
            } : { strategy: 'id-map' },
        };

        await settingsStore.saveSetting(sourceObjectId, targetObjectId, payload);
        if (upsertConfig !== undefined) {
            const cfg = upsertConfig;
            await pipelineStore.saveUpsertConfig(sourceObjectId, targetObjectId, {
                operation: cfg.operation,
                externalIdFieldId: cfg.externalIdFieldId,
            });
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
            <div class="field-row">
                <label for="setting-reference-strategy">Parent Reference Matching</label>
                <Select
                    inputId="setting-reference-strategy"
                    v-model="form.referenceStrategy"
                    :options="strategyOptions"
                    optionLabel="label"
                    optionValue="value"
                    :disabled="loading || !loaded || saving"
                    :loading="loading"
                    class="w-full"
                />
                <small class="field-hint">
                    Controls how child references to this parent object pair resolve. Rerun extraction after changing reference matching settings.
                </small>
            </div>

            <template v-if="matchExisting">
                <Message severity="info" :closable="false">
                    Match-existing only references existing target records; it never loads this object.
                    Missing or duplicate matches cause dependent child records to be skipped.
                </Message>
                <div class="field-row">
                    <label for="setting-source-field">Source Match Field</label>
                    <Select
                        inputId="setting-source-field"
                        v-model="form.sourceField"
                        :options="sourceFields"
                        optionLabel="name"
                        optionValue="name"
                        placeholder="Select source field"
                        filter
                        :disabled="loading || !loaded || saving"
                        class="w-full"
                    />
                </div>
                <div class="field-row">
                    <label for="setting-target-field">Target Match Field</label>
                    <Select
                        inputId="setting-target-field"
                        v-model="form.targetField"
                        :options="targetFields"
                        optionLabel="name"
                        optionValue="name"
                        placeholder="Select target field"
                        filter
                        :disabled="loading || !loaded || saving"
                        class="w-full"
                    />
                </div>
                <div class="field-row">
                    <label for="setting-normalizer">Match Value Normalizer</label>
                    <Select
                        inputId="setting-normalizer"
                        v-model="form.normalizer"
                        :options="normalizerOptions"
                        optionLabel="label"
                        optionValue="value"
                        :disabled="loading || !loaded || saving"
                        class="w-full"
                    />
                </div>
            </template>

            <div v-show="!matchExisting" class="field-row">
                <label>Load Operation &amp; External ID</label>
                <UpsertConfigSelect
                    :sourceObjectId="sourceObjectId"
                    :targetObjectId="targetObjectId"
                    :autoSave="false"
                    :disabled="loading || !loaded || saving"
                    @change="onUpsertConfigChange"
                />
                <small class="field-hint">
                    For <strong>Upsert</strong> (default), Salesforce matches target records via the chosen External ID field — updating existing records or creating new ones. The External ID field must also be mapped to a source field. For <strong>Insert</strong>, all records are always created as new.
                </small>
            </div>

            <div class="field-row">
                <small class="field-hint">
                    Extract filters (SOQL WHERE clauses) are configured per <strong>source object</strong> in the Extraction pane of the Pipeline view.
                </small>
            </div>

            <Divider />

            <div class="under-dev-section">
                <Message severity="warn" :closable="false">
                    <template #messageicon><i class="pi pi-wrench"></i></template>
                    The settings below are under development and have no effect yet.
                </Message>

                <div class="field-row">
                    <label for="setting-batch">
                        Batch Size
                        <Tag value="Under development" severity="warn" class="ml-2" />
                    </label>
                    <InputNumber
                        id="setting-batch"
                        v-model="form.batchSize"
                        :min="1"
                        :max="10000"
                        showButtons
                        :disabled="true"
                        class="w-full"
                    />
                </div>

                <div class="field-row checkbox-row">
                    <Checkbox v-model="form.sortToAvoidLocks" :binary="true" inputId="setting-sort" :disabled="true" />
                    <label for="setting-sort">
                        Sort records to avoid row locks
                        <Tag value="Under development" severity="warn" class="ml-2" />
                    </label>
                </div>
            </div>
        </form>

        <template #footer>
            <Button label="Cancel" icon="pi pi-times" text @click="onClose" />
            <Button label="Save" icon="pi pi-check" :loading="saving" :disabled="!canSave" @click="onSave" />
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

.ml-2 {
    margin-left: 0.5rem;
}

.under-dev-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.75rem;
    border-radius: 6px;
    background: var(--surface-ground);
}

.filter-textarea {
    font-family: var(--font-family-monospace, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.85rem;
}
</style>
