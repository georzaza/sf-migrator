<script setup>
/**
 * FieldList - Displays fields for a Salesforce object.
 * Reusable: used in Dashboard (ObjectDetail) and Migration Workspace.
 *
 * Props:
 *   fields - Array of field metadata
 *   loading - Whether fields are loading
 *
 * Shows field label and API name (in brackets).
 */
import { ref, computed } from 'vue';

const props = defineProps({
    fields: {
        type: Array,
        default: () => [],
    },
    loading: {
        type: Boolean,
        default: false,
    },
});

const searchQuery = ref('');

const filteredFields = computed(() => {
    if (!searchQuery.value.trim()) return props.fields;
    const query = searchQuery.value.toLowerCase();
    return props.fields.filter(f =>
        f.fieldName?.toLowerCase().includes(query) ||
        f.fieldLabel?.toLowerCase().includes(query)
    );
});

const fieldCount = computed(() => {
    const total = props.fields.length;
    const filtered = filteredFields.value.length;
    if (filtered === total) return `${total} fields`;
    return `${filtered} of ${total} fields`;
});
</script>

<template>
    <div class="field-list">
        <div class="field-list-header">
            <h4>Fields</h4>
            <span class="field-count">{{ fieldCount }}</span>
        </div>

        <div v-if="loading" class="field-list-loading">
            <ProgressSpinner style="width: 1.5rem; height: 1.5rem;" />
            <span>Loading fields...</span>
        </div>

        <template v-else-if="fields.length > 0">
            <InputText
                v-model="searchQuery"
                placeholder="Search fields..."
                size="small"
                class="field-search"
            />

            <div v-if="filteredFields.length === 0" class="field-list-empty">
                <p>No fields match your search.</p>
            </div>

            <div v-else class="field-items">
                <div
                    v-for="field in filteredFields"
                    :key="field.id || field.fieldName"
                    class="field-item"
                >
                    <span class="field-label">{{ field.fieldLabel }}</span>
                    <span class="field-api">({{ field.fieldName }})</span>
                </div>
            </div>
        </template>

        <div v-else class="field-list-empty">
            <p>No fields available.</p>
        </div>
    </div>
</template>

<style scoped>
.field-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.field-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.field-list-header h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
}

.field-count {
    font-size: 0.8rem;
    color: var(--text-color-secondary);
}

.field-list-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    justify-content: center;
    color: var(--text-color-secondary);
    font-size: 0.9rem;
}

.field-search {
    width: 100%;
}

.field-list-empty {
    text-align: center;
    padding: 1rem;
    color: var(--text-color-secondary);
    font-size: 0.9rem;
}

.field-items {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    max-height: 350px;
    overflow-y: auto;
}

.field-item {
    display: flex;
    gap: 0.35rem;
    align-items: baseline;
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
}

.field-item:hover {
    background-color: var(--surface-hover);
}

.field-label {
    font-size: 0.85rem;
    font-weight: 500;
}

.field-api {
    font-size: 0.75rem;
    color: var(--text-color-secondary);
}
</style>
