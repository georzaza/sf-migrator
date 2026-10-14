<!--
  Recursive visual editor for a transform node tree (see docs/TRANSFORMATIONS.md
  and SERVER/src/utils/transformTree.js). Emits a plain tree object via v-model;
  the backend accepts it directly as FieldMapping.transform. Renders itself for
  child nodes.
-->
<template>
    <div class="tn-editor" :style="{ marginLeft: depth > 0 ? '0.75rem' : '0' }">
        <div class="tn-row">
            <Dropdown
                :modelValue="node.kind"
                :options="kindOptions"
                optionLabel="label"
                optionValue="value"
                class="tn-kind"
                @update:modelValue="changeKind"
            />

            <!-- field -->
            <Dropdown
                v-if="node.kind === 'field'"
                v-model="node.path"
                :options="sourceFieldNames"
                editable
                placeholder="Object.Field or Object.Rel.Field"
                class="tn-grow"
            />

            <!-- const -->
            <InputText
                v-if="node.kind === 'const'"
                v-model="node.value"
                placeholder="Constant value"
                class="tn-grow"
            />

            <!-- func -->
            <Dropdown
                v-if="node.kind === 'func'"
                v-model="node.name"
                :options="functionNames"
                class="tn-func"
            />

            <!-- compare / binop operator -->
            <Dropdown
                v-if="node.kind === 'compare'"
                v-model="node.op"
                :options="compareOps"
                class="tn-op"
            />
            <Dropdown
                v-if="node.kind === 'binop'"
                v-model="node.op"
                :options="binOps"
                class="tn-op"
            />
        </div>

        <!-- concat / coalesce: list of child nodes -->
        <div v-if="node.kind === 'concat' || node.kind === 'coalesce'" class="tn-children">
            <div v-for="(child, i) in node[listKey]" :key="i" class="tn-child-row">
                <TransformNodeEditor v-model="node[listKey][i]" :sourceFields="sourceFields" :depth="depth + 1" />
                <Button icon="pi pi-times" severity="danger" text rounded @click="removeFromList(i)" v-tooltip.top="'Remove'" />
            </div>
            <Button label="Add part" icon="pi pi-plus" size="small" text @click="addToList" />
        </div>

        <!-- func args -->
        <div v-if="node.kind === 'func'" class="tn-children">
            <label class="tn-sub">Arguments</label>
            <div v-for="(child, i) in node.args" :key="i" class="tn-child-row">
                <TransformNodeEditor v-model="node.args[i]" :sourceFields="sourceFields" :depth="depth + 1" />
                <Button icon="pi pi-times" severity="danger" text rounded @click="removeArg(i)" v-tooltip.top="'Remove'" />
            </div>
            <Button label="Add argument" icon="pi pi-plus" size="small" text @click="addArg" />
        </div>

        <!-- compare / binop left & right -->
        <div v-if="node.kind === 'compare' || node.kind === 'binop'" class="tn-children">
            <label class="tn-sub">Left</label>
            <TransformNodeEditor v-model="node.left" :sourceFields="sourceFields" :depth="depth + 1" />
            <label class="tn-sub">Right</label>
            <TransformNodeEditor v-model="node.right" :sourceFields="sourceFields" :depth="depth + 1" />
        </div>

        <!-- if -->
        <div v-if="node.kind === 'if'" class="tn-children">
            <label class="tn-sub">If (condition)</label>
            <TransformNodeEditor v-model="node.cond" :sourceFields="sourceFields" :depth="depth + 1" />
            <label class="tn-sub">Then</label>
            <TransformNodeEditor v-model="node.then" :sourceFields="sourceFields" :depth="depth + 1" />
            <label class="tn-sub">Else</label>
            <TransformNodeEditor v-model="node.else" :sourceFields="sourceFields" :depth="depth + 1" />
        </div>

        <!-- valueMap -->
        <div v-if="node.kind === 'valueMap'" class="tn-children">
            <label class="tn-sub">Input</label>
            <TransformNodeEditor v-model="node.input" :sourceFields="sourceFields" :depth="depth + 1" />
            <label class="tn-sub">Mappings</label>
            <div v-for="(row, i) in mapRows" :key="i" class="tn-map-row">
                <InputText v-model="row.from" placeholder="source value" class="tn-map-in" @input="syncTable" />
                <i class="pi pi-arrow-right" />
                <InputText v-model="row.to" placeholder="target value" class="tn-map-in" @input="syncTable" />
                <Button icon="pi pi-times" severity="danger" text rounded @click="removeMapRow(i)" v-tooltip.top="'Remove'" />
            </div>
            <Button label="Add value" icon="pi pi-plus" size="small" text @click="addMapRow" />
            <label class="tn-sub">Default (when no match)</label>
            <InputText v-model="valueMapDefault" placeholder="leave blank for null" class="tn-grow" @input="syncDefault" />
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';

const props = defineProps({
    modelValue: { type: Object, default: () => ({ kind: 'field', path: '' }) },
    sourceFields: { type: Array, default: () => [] },
    depth: { type: Number, default: 0 },
});
const emit = defineEmits(['update:modelValue']);

const node = reactive(clone(props.modelValue));

// Keep the local node in sync when the parent replaces the value wholesale.
watch(() => props.modelValue, (val) => {
    if (JSON.stringify(val) !== JSON.stringify(node)) {
        Object.keys(node).forEach((k) => delete node[k]);
        Object.assign(node, clone(val));
        hydrateValueMap();
    }
});

// Emit any internal change upward.
watch(node, () => emit('update:modelValue', clone(node)), { deep: true });

const kindOptions = [
    { label: 'Field', value: 'field' },
    { label: 'Constant', value: 'const' },
    { label: 'Concatenate', value: 'concat' },
    { label: 'Function', value: 'func' },
    { label: 'If / Else', value: 'if' },
    { label: 'Compare', value: 'compare' },
    { label: 'Math', value: 'binop' },
    { label: 'First non-empty', value: 'coalesce' },
    { label: 'Value map', value: 'valueMap' },
];

const functionNames = ['SUBSTR', 'LEN', 'UPPER', 'LOWER', 'TRIM', 'DATE', 'DATETIME', 'ADDDAYS', 'ADDHOURS'];
const compareOps = ['=', '!=', '<', '<=', '>', '>='];
const binOps = ['+', '-', '*', '/'];

const sourceFieldNames = computed(() => (props.sourceFields || []).map((f) => f.name).filter(Boolean));
const listKey = computed(() => (node.kind === 'concat' ? 'parts' : 'args'));

function clone(obj) {
    return JSON.parse(JSON.stringify(obj ?? {}));
}

const DEFAULTS = {
    field: () => ({ kind: 'field', path: '' }),
    const: () => ({ kind: 'const', value: '' }),
    concat: () => ({ kind: 'concat', parts: [{ kind: 'field', path: '' }, { kind: 'const', value: '' }] }),
    func: () => ({ kind: 'func', name: 'SUBSTR', args: [{ kind: 'field', path: '' }, { kind: 'const', value: 1 }, { kind: 'const', value: 1 }] }),
    if: () => ({ kind: 'if', cond: { kind: 'compare', op: '=', left: { kind: 'field', path: '' }, right: { kind: 'const', value: '' } }, then: { kind: 'const', value: '' }, else: { kind: 'const', value: '' } }),
    compare: () => ({ kind: 'compare', op: '=', left: { kind: 'field', path: '' }, right: { kind: 'const', value: '' } }),
    binop: () => ({ kind: 'binop', op: '+', left: { kind: 'field', path: '' }, right: { kind: 'const', value: 1 } }),
    coalesce: () => ({ kind: 'coalesce', args: [{ kind: 'field', path: '' }, { kind: 'const', value: '' }] }),
    valueMap: () => ({ kind: 'valueMap', input: { kind: 'field', path: '' }, table: {}, default: null }),
};

function changeKind(kind) {
    const next = DEFAULTS[kind]();
    Object.keys(node).forEach((k) => delete node[k]);
    Object.assign(node, next);
    hydrateValueMap();
}

function addToList() {
    node[listKey.value].push({ kind: 'const', value: '' });
}
function removeFromList(i) {
    node[listKey.value].splice(i, 1);
}
function addArg() {
    node.args.push({ kind: 'const', value: '' });
}
function removeArg(i) {
    node.args.splice(i, 1);
}

/* valueMap table <-> editable rows */
const mapRows = ref([]);
const valueMapDefault = ref('');

function hydrateValueMap() {
    if (node.kind === 'valueMap') {
        mapRows.value = Object.entries(node.table || {}).map(([from, to]) => ({ from, to: String(to ?? '') }));
        valueMapDefault.value = node.default && node.default.kind === 'const' ? String(node.default.value ?? '') : '';
    }
}
hydrateValueMap();

function syncTable() {
    const table = {};
    for (const row of mapRows.value) {
        if (row.from !== '' && row.from !== null && row.from !== undefined) {
            table[row.from] = row.to;
        }
    }
    node.table = table;
}
function syncDefault() {
    node.default = valueMapDefault.value === '' ? null : { kind: 'const', value: valueMapDefault.value };
}
function addMapRow() {
    mapRows.value.push({ from: '', to: '' });
}
function removeMapRow(i) {
    mapRows.value.splice(i, 1);
    syncTable();
}
</script>

<style scoped>
.tn-editor {
    border-left: 2px solid var(--surface-200, #e9ecef);
    padding-left: 0.5rem;
    margin-top: 0.4rem;
}
.tn-row {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;
}
.tn-kind {
    min-width: 9rem;
}
.tn-func,
.tn-op {
    min-width: 6rem;
}
.tn-grow {
    flex: 1;
    min-width: 10rem;
}
.tn-children {
    margin-top: 0.3rem;
}
.tn-sub {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-color-secondary, #6c757d);
    margin: 0.35rem 0 0.1rem;
}
.tn-child-row,
.tn-map-row {
    display: flex;
    gap: 0.4rem;
    align-items: center;
}
.tn-map-in {
    flex: 1;
    min-width: 7rem;
}
</style>
