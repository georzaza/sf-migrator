<!--
  Record Expansion (explode) builder. Configures a 1-source-row -> N-target-rows
  transform: each variant yields one target record, built from transform trees
  (reusing TransformNodeEditor) and gated by an optional filter. Persists via the
  upsert-record-expansion API. See docs/TRANSFORMATIONS.md (Layer 2).
-->
<template>
    <Dialog
        :visible="visible"
        @update:visible="$emit('update:visible', $event)"
        modal
        :header="`Record Expansion — ${sourceObject?.label || sourceObject?.name} → ${targetObject?.label || targetObject?.name}`"
        :style="{ width: '60rem', maxWidth: '95vw' }"
    >
        <p class="re-intro">
            One source record fans out into one target record per variant below.
            A variant with a condition is only created when that condition is met.
        </p>

        <div v-for="(variant, vi) in variants" :key="vi" class="re-variant">
            <div class="re-variant-head">
                <span class="re-variant-title">Variant {{ vi + 1 }}</span>
                <InputText v-model="variant.key" placeholder="label (e.g. primary)" class="re-key" />
                <Button icon="pi pi-trash" severity="danger" text rounded @click="removeVariant(vi)" v-tooltip.top="'Remove variant'" />
            </div>

            <div class="re-condition">
                <div class="re-condition-toggle">
                    <Checkbox v-model="variant.useFilter" :inputId="`flt-${vi}`" binary />
                    <label :for="`flt-${vi}`">Only create when a condition is met</label>
                </div>
                <TransformNodeEditor v-if="variant.useFilter" v-model="variant.filter" :sourceFields="sourceFields" />
            </div>

            <label class="re-sub">Target fields</label>
            <div v-for="(row, ri) in variant.fieldRows" :key="ri" class="re-field-row">
                <Dropdown
                    v-model="row.targetFieldName"
                    :options="targetFieldNames"
                    editable
                    placeholder="Target field API name"
                    class="re-target-field"
                />
                <div class="re-field-value">
                    <TransformNodeEditor v-model="row.value" :sourceFields="sourceFields" />
                </div>
                <Button icon="pi pi-times" severity="danger" text rounded @click="removeFieldRow(variant, ri)" v-tooltip.top="'Remove field'" />
            </div>
            <Button label="Add target field" icon="pi pi-plus" size="small" text @click="addFieldRow(variant)" />
        </div>

        <Button label="Add variant" icon="pi pi-plus" severity="secondary" outlined class="mt-2" @click="addVariant" />

        <template #footer>
            <Button
                v-if="existingId"
                label="Delete"
                icon="pi pi-trash"
                severity="danger"
                text
                :loading="deleting"
                @click="remove"
            />
            <Button label="Cancel" icon="pi pi-times" text @click="$emit('update:visible', false)" />
            <Button label="Save" icon="pi pi-check" :loading="saving" @click="save" />
        </template>
    </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useMappingStore } from '@/stores/mappingStore';
import TransformNodeEditor from '@/components/mapping/TransformNodeEditor.vue';

const props = defineProps({
    visible: { type: Boolean, default: false },
    sourceOrgId: { type: String, default: null },
    targetOrgId: { type: String, default: null },
    sourceObject: { type: Object, default: null },
    targetObject: { type: Object, default: null },
    sourceFields: { type: Array, default: () => [] },
    targetFields: { type: Array, default: () => [] },
});
defineEmits(['update:visible', 'saved']);

const toast = useToast();
const mappingStore = useMappingStore();

const variants = ref([]);
const existingId = ref(null);
const saving = ref(false);
const deleting = ref(false);

const targetFieldNames = computed(() => (props.targetFields || []).map((f) => f.name).filter(Boolean));

function newFieldRow() {
    return { targetFieldName: '', value: { kind: 'field', path: '' } };
}
function newVariant() {
    return { key: '', useFilter: false, filter: { kind: 'field', path: '' }, fieldRows: [newFieldRow()] };
}

function addVariant() {
    variants.value.push(newVariant());
}
function removeVariant(i) {
    variants.value.splice(i, 1);
}
function addFieldRow(variant) {
    variant.fieldRows.push(newFieldRow());
}
function removeFieldRow(variant, i) {
    variant.fieldRows.splice(i, 1);
}

// Load the existing expansion (if any) whenever the dialog opens for a pair.
watch(() => props.visible, async (open) => {
    if (!open) return;
    existingId.value = null;
    variants.value = [newVariant()];

    if (!props.sourceOrgId || !props.targetOrgId || !props.sourceObject?.id || !props.targetObject?.id) return;

    try {
        const all = await mappingStore.loadRecordExpansions(props.sourceOrgId, props.targetOrgId);
        const match = all.find(
            (e) => e.sourceObjectId === props.sourceObject.id && e.targetObjectId === props.targetObject.id,
        );
        if (match) {
            existingId.value = match.id;
            variants.value = (match.variants || []).map(hydrateVariant);
            if (variants.value.length === 0) variants.value = [newVariant()];
        }
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to load expansion', life: 3000 });
    }
});

function hydrateVariant(v) {
    return {
        key: v.key || '',
        useFilter: !!v.filter,
        filter: v.filter || { kind: 'field', path: '' },
        fieldRows: Object.entries(v.fields || {}).map(([targetFieldName, value]) => ({ targetFieldName, value })),
    };
}

function buildPayload() {
    return variants.value.map((v) => {
        const fields = {};
        for (const row of v.fieldRows) {
            const name = String(row.targetFieldName || '').trim();
            if (name) fields[name] = row.value;
        }
        return {
            key: v.key || undefined,
            filter: v.useFilter ? v.filter : null,
            fields,
        };
    });
}

async function save() {
    const payload = buildPayload();
    if (payload.some((v) => Object.keys(v.fields).length === 0)) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: 'Each variant must map at least one target field', life: 3000 });
        return;
    }
    saving.value = true;
    try {
        await mappingStore.upsertRecordExpansion(props.sourceObject.id, props.targetObject.id, payload);
        toast.add({ severity: 'success', summary: 'Saved', detail: 'Record expansion saved', life: 3000 });
        existingId.value = existingId.value || true;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || err.message || 'Failed to save', life: 4000 });
    } finally {
        saving.value = false;
    }
}

async function remove() {
    if (!existingId.value || existingId.value === true) return;
    deleting.value = true;
    try {
        await mappingStore.deleteRecordExpansion(existingId.value);
        toast.add({ severity: 'success', summary: 'Deleted', detail: 'Record expansion removed', life: 3000 });
        existingId.value = null;
        variants.value = [newVariant()];
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to delete', life: 3000 });
    } finally {
        deleting.value = false;
    }
}
</script>

<style scoped>
.re-intro {
    font-size: 0.85rem;
    color: var(--text-color-secondary, #6c757d);
    margin-bottom: 0.75rem;
}
.re-variant {
    border: 1px solid var(--surface-200, #e9ecef);
    border-radius: 8px;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
}
.re-variant-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}
.re-variant-title {
    font-weight: 600;
}
.re-key {
    flex: 1;
    max-width: 16rem;
}
.re-condition {
    margin-bottom: 0.5rem;
}
.re-condition-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
}
.re-sub {
    display: block;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-color-secondary, #6c757d);
    margin: 0.5rem 0 0.25rem;
}
.re-field-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    margin-bottom: 0.4rem;
}
.re-target-field {
    min-width: 12rem;
}
.re-field-value {
    flex: 1;
}
</style>
