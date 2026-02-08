<script setup>
/**
 * ObjectDetail - Shows basic info about a selected Salesforce object
 * and embeds a FieldList to display its fields.
 *
 * Props:
 *   object - Selected object metadata
 *   fields - Array of field metadata for the object
 *   loadingFields - Whether fields are being loaded
 *
 * Emits:
 *   load-fields - When user clicks to load/view fields
 */
import { ref, watch } from 'vue';
import FieldList from './FieldList.vue';

const props = defineProps({
    object: {
        type: Object,
        default: null,
    },
    fields: {
        type: Array,
        default: () => [],
    },
    loadingFields: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(['load-fields']);

const showFields = ref(false);

// Reset showFields when object changes
watch(() => props.object, () => {
    showFields.value = false;
});

function onToggleFields() {
    showFields.value = !showFields.value;
    if (showFields.value && props.fields.length === 0) {
        emit('load-fields', props.object);
    }
}
</script>

<template>
    <div v-if="object" class="object-detail">
        <div class="object-detail-header">
            <h3>{{ object.objectLabel }}</h3>
            <Tag v-if="object.isCustom" value="Custom" severity="info" />
            <Tag v-else value="Standard" severity="secondary" />
        </div>

        <div class="object-info">
            <div class="info-row">
                <span class="info-label">API Name:</span>
                <span class="info-value">{{ object.objectName }}</span>
            </div>
            <div v-if="object.recordCount != null" class="info-row">
                <span class="info-label">Record Count:</span>
                <span class="info-value">{{ object.recordCount?.toLocaleString() ?? 'N/A' }}</span>
            </div>
        </div>

        <Divider />

        <Button
            :label="showFields ? 'Hide Fields' : 'View Fields'"
            :icon="showFields ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
            size="small"
            severity="secondary"
            outlined
            @click="onToggleFields"
        />

        <div v-if="showFields" class="object-detail-fields">
            <FieldList :fields="fields" :loading="loadingFields" />
        </div>
    </div>
</template>

<style scoped>
.object-detail {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.object-detail-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.object-detail-header h3 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 600;
}

.object-info {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.info-row {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
}

.info-label {
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--text-color-secondary);
    min-width: 100px;
}

.info-value {
    font-size: 0.9rem;
}

.object-detail-fields {
    margin-top: 0.5rem;
}
</style>
