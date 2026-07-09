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

const defaultForm = () => ({
    enabled: true,
    batchSize: 200,
    sortToAvoidLocks: false,
});

const form = ref(defaultForm());
const saving = ref(false);
const errorMessage = ref('');
// undefined = user has not changed the traceback in this dialog session.
// Otherwise: null to clear, or { strategy, fields:[{id,name}] }.
const pendingTraceback = ref(undefined);

const dialogHeader = computed(() => {
    const src = props.sourceObjectLabel || 'Source';
    const tgt = props.targetObjectLabel || 'Target';
    return `Migration Settings: ${src} → ${tgt}`;
});

watch(() => props.visible, async (val) => {
    if (!val) return;

    errorMessage.value = '';
    form.value = defaultForm();
    pendingTraceback.value = undefined;

    if (!props.sourceObjectId || !props.targetObjectId) return;

    try {
        const setting = await settingsStore.loadSetting(props.sourceObjectId, props.targetObjectId);
        if (setting) {
            form.value = {
                enabled: setting.enabled ?? true,
                batchSize: setting.batchSize ?? 200,
                sortToAvoidLocks: setting.sortToAvoidLocks ?? false,
            };
        }
    } catch (error) {
        errorMessage.value = error.response?.data?.message || error.message || 'Failed to load settings';
    }
});

function onClose() {
    emit('update:visible', false);
}

function onTracebackChange(selection) {
    // selection = { strategy, fields:[{id,name}] } or { strategy: null, fields: [] }
    pendingTraceback.value = selection;
}

async function onSave() {
    if (!props.sourceObjectId || !props.targetObjectId) return;

    saving.value = true;
    errorMessage.value = '';

    try {
        const payload = {
            enabled: form.value.enabled,
            batchSize: form.value.batchSize,
            sortToAvoidLocks: form.value.sortToAvoidLocks,
        };

        await settingsStore.saveSetting(props.sourceObjectId, props.targetObjectId, payload);
        if (pendingTraceback.value !== undefined) {
            const sel = pendingTraceback.value;
            const body = sel?.strategy
                ? { strategy: sel.strategy, fieldIds: sel.fields.map((f) => f.id) }
                : null;
            await pipelineStore.saveTraceback(props.sourceObjectId, props.targetObjectId, body);
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
                <label>Traceback (source &harr; target correlation)</label>
                <TracebackFieldSelect
                    :sourceObjectId="sourceObjectId"
                    :targetObjectId="targetObjectId"
                    :autoSave="false"
                    @change="onTracebackChange"
                />
                <small class="field-hint">
                    How records are traced back to the source after load. Pick a single field (External Id, Unique, or Alphanumeric &ge; 18 chars) — the source record Id is written into it — or a combination of fields (composite key) where you guarantee uniqueness.
                </small>
            </div>

            <div class="field-row">
                <small class="field-hint">
                    Extract filters (SOQL WHERE clauses) are now configured per <strong>source object</strong> in the Pipeline view's Extraction pane.
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
