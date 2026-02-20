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
    loadingObjects: {
        type: Boolean,
        default: false
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
        <!-- Header — always visible, never covered by overlay -->
        <div class="detail-header">
            <h2>{{ org.name }}</h2>
            <span v-if="org.description" class="detail-desc">{{ org.description }}</span>
        </div>

        <!-- Body — overlay is positioned relative to this -->
        <div class="detail-body">

            <!-- Analysis spinner — covers body while analyzing (both first-analyze and re-analyze) -->
            <div v-if="analyzingOrgId" class="analysis-overlay">
                <ProgressSpinner style="width: 3rem; height: 3rem;" />
                <span>Analyzing org&hellip;</span>
            </div>

            <!-- Checking for existing analysis -->
            <div v-if="checkingAnalysis" class="detail-loading">
                <ProgressSpinner style="width: 2rem; height: 2rem;" />
                <span>Checking for existing analysis...</span>
            </div>

            <!-- No analysis yet -->
            <template v-else-if="!hasAnalysis">
                <div class="no-analysis">
                    <i class="pi pi-search" style="font-size: 2rem; color: var(--text-color-secondary);"></i>
                    <p>No analysis found for this org.</p>
                    <Button
                        label="Analyze Org"
                        icon="pi pi-cloud-download"
                        @click="emit('analyze')"
                    />
                </div>
            </template>

            <!-- Has analysis -->
            <template v-else>
                <div class="analysis-actions">
                    <Button
                        label="Re-Analyze Org"
                        icon="pi pi-refresh"
                        size="small"
                        severity="warning"
                        outlined
                        @click="emit('analyze')"
                    />
                </div>

                <div class="analysis-content">
                    <!-- Left: Object List + Object Detail Header -->
                    <div class="analysis-left-column">
                        <div class="analysis-panel">
                            <ObjectList
                                :objects="objects"
                                :selectedObject="selectedObject"
                                :loading="loadingObjects"
                                @select-object="emit('select-object', $event)"
                            />
                        </div>
                        <div v-if="selectedObject" class="analysis-panel">
                            <ObjectDetail :object="selectedObject" />
                        </div>
                    </div>

                    <!-- Right: Field List -->
                    <div v-if="selectedObject" class="analysis-panel">
                        <FieldList :fields="fields" :loading="loadingFields" />
                    </div>
                </div>
            </template>

        </div><!-- /detail-body -->
    </div>
</template>

<style scoped>
.detail-panel {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    padding: 1.25rem;
    min-height: 300px;
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

.detail-loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    justify-content: center;
    color: var(--text-color-secondary);
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

.analysis-overlay {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.75);
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    border-radius: 8px;
    font-size: 0.95rem;
    color: var(--text-color-secondary);
}

@media (max-width: 1200px) {
    .analysis-content {
        grid-template-columns: 1fr;
    }
}
</style>
