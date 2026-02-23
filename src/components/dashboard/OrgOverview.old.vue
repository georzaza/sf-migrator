<script setup>
import ObjectList from '@/components/dashboard/ObjectList.vue';
import ObjectDetail from '@/components/dashboard/ObjectDetail.vue';

const props = defineProps({
    org: {
        type: Object,
        required: true
    },
    analyzingOrgId: {
        type: String,
        default: null
    },
    hasAnalysis: {
        type: Boolean,
        default: false
    },
    checkingAnalysis: {
        type: Boolean,
        default: false
    },
    objects: {
        type: Array,
        default: () => []
    },
    selectedObject: {
        type: Object,
        default: null
    },
    fields: {
        type: Array,
        default: () => []
    },
    loadingFields: {
        type: Boolean,
        default: false
    },
});

const emit = defineEmits(['analyze', 'select-object']);
</script>

<template>
    <div class="dashboard-panel detail-panel">


        <!-- Header -->
        <div class="detail-header">
            <h2>{{ org.name }}</h2>
            <span v-if="org.description" class="detail-desc">{{ org.description }}</span>
        </div>

        <!-- Body -->
        <div class="detail-body">

            <div></div>

            <!-- Analysis in progress -->
            <div v-if="analyzingOrgId" class="loading-overlay">
                <ProgressSpinner />
                <span>Analyzing org</span>
            </div>

            <!-- Polling for analysis -->
            <div v-else-if="checkingAnalysis" class="loading-overlay">
                <ProgressSpinner />
                <span>Retrieving org details...</span>
            </div>

            <!-- No analysis -->
            <template v-else-if="!hasAnalysis">
                <div class="analysis-actions">
                    <Button
                        label="Analyze Org"
                        icon="pi pi-cloud-download"
                        size="small"
                        @click="emit('analyze')"
                        :disabled="analyzingOrgId || checkingAnalysis"
                    />
                </div>
            </template>

            <!-- Has analysis -->
            <template v-else>
                <div class="analysis-actions">
                    <Button
                        label="Re-Analyze Org"
                        icon="pi pi-cloud-download"
                        @click="emit('analyze')"
                    />
                </div>
            </template>

        </div>
    </div>
</template>

<style scoped>
.detail-panel {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    padding: 1.25rem;
    position: relative;
}

.detail-header {
    margin-bottom: 1rem;
}

.detail-header h2 {
    margin: 0 0 0.25rem 0;
    font-size: 1.3rem;
}

.detail-desc {
    font-size: 0.9rem;
    color: var(--text-color-secondary);
}

.detail-body {
    position: relative;
}

.no-analysis {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--text-color-secondary);
}

.analysis-actions {
    margin-bottom: 1rem;
}

.analysis-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    align-items: start;
}

.analysis-left-column {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.analysis-panel {
    background: var(--surface-ground);
    border-radius: 8px;
    padding: 1rem;
}

.loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.75);
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    font-size: 0.95rem;
    color: var(--text-color-secondary);
    max-height: 50px;
}

@media (max-width: 1200px) {
    .analysis-content {
        grid-template-columns: 1fr;
    }
}
</style>
