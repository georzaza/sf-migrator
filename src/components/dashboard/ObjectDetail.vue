<script setup>
/**
 * ObjectDetail - Shows basic info about a selected Salesforce object
 *
 * Props:
 *   object - Selected object metadata
 */
import { ref } from 'vue';

const props = defineProps({
    object: {
        type: Object,
        default: null,
    },
});
</script>

<template>
    <div v-if="object" class="object-detail">
        <div class="object-detail-header">
            <h3>{{ object.objectLabel }}</h3>
            <Tag v-if="object.isCustom" value="Custom Object" severity="info" />
            <Tag v-else value="Standard Object" severity="secondary" />
        </div>

        <div class="object-info">
            <div class="info-row">
                <span class="info-label">API Name:</span>
                <span class="info-value">{{ object.objectName }}</span>
            </div>
            <div v-if="object.recordCount != null" class="info-row">
                <span class="info-label">Total Records:</span>
                <span class="info-value">{{ object.recordCount?.toLocaleString() ?? 'N/A' }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.object-detail {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    justify-content: space-between;
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
