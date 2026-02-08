<script setup>
/**
 * ObjectList - Displays Salesforce objects for an org with search/filter.
 * Reusable: used in Dashboard and Migration Workspace (source + target panels).
 *
 * Props:
 *   objects - Array of object metadata
 *   selectedObject - Currently selected object (for highlighting)
 *   loading - Whether objects are loading
 *   title - Optional title override
 *
 * Emits:
 *   select-object - When an object row is clicked
 */
import { ref, computed } from 'vue';

const props = defineProps({
    objects: {
        type: Array,
        default: () => [],
    },
    selectedObject: {
        type: Object,
        default: null,
    },
    loading: {
        type: Boolean,
        default: false,
    },
    title: {
        type: String,
        default: 'Objects',
    },
});

const emit = defineEmits(['select-object']);

const searchQuery = ref('');
const showCustomOnly = ref(false);

const filteredObjects = computed(() => {
    let result = props.objects;

    if (showCustomOnly.value) {
        result = result.filter(obj => obj.isCustom);
    }

    if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter(obj =>
            obj.objectName?.toLowerCase().includes(query) ||
            obj.objectLabel?.toLowerCase().includes(query)
        );
    }

    return result;
});

const objectCount = computed(() => {
    const total = props.objects.length;
    const filtered = filteredObjects.value.length;
    if (filtered === total) return `${total} objects`;
    return `${filtered} of ${total} objects`;
});

function isSelected(obj) {
    return props.selectedObject?.id === obj.id;
}
</script>

<template>
    <div class="object-list">
        <div class="object-list-header">
            <h3>{{ title }}</h3>
            <span class="object-count">{{ objectCount }}</span>
        </div>

        <div v-if="loading" class="object-list-loading">
            <ProgressSpinner style="width: 2rem; height: 2rem;" />
            <span>Loading objects...</span>
        </div>

        <template v-else>
            <div class="object-list-filters">
                <InputText
                    v-model="searchQuery"
                    placeholder="Search objects..."
                    size="small"
                    class="object-search"
                />
                <div class="flex items-center gap-2">
                    <Checkbox v-model="showCustomOnly" :binary="true" inputId="customOnly" />
                    <label for="customOnly" class="text-sm">Custom only</label>
                </div>
            </div>

            <div v-if="filteredObjects.length === 0" class="object-list-empty">
                <p>No objects found.</p>
            </div>

            <div v-else class="object-items">
                <div
                    v-for="obj in filteredObjects"
                    :key="obj.id"
                    class="object-item"
                    :class="{ 'object-item-selected': isSelected(obj) }"
                    @click="emit('select-object', obj)"
                >
                    <div class="object-item-info">
                        <span class="object-item-label">{{ obj.objectLabel }}</span>
                        <span class="object-item-api">({{ obj.objectName }})</span>
                    </div>
                    <Tag
                        v-if="obj.isCustom"
                        value="Custom"
                        severity="info"
                        class="object-tag"
                    />
                </div>
            </div>
        </template>
    </div>
</template>

<style scoped>
.object-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.object-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.object-list-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
}

.object-count {
    font-size: 0.85rem;
    color: var(--text-color-secondary);
}

.object-list-loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem;
    justify-content: center;
    color: var(--text-color-secondary);
}

.object-list-filters {
    display: flex;
    gap: 1rem;
    align-items: center;
}

.object-search {
    flex: 1;
}

.object-list-empty {
    text-align: center;
    padding: 1.5rem;
    color: var(--text-color-secondary);
}

.object-items {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 400px;
    overflow-y: auto;
}

.object-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.15s;
}

.object-item:hover {
    background-color: var(--surface-hover);
}

.object-item-selected {
    background-color: var(--primary-50);
}

:root.app-dark .object-item-selected {
    background-color: color-mix(in srgb, var(--primary-color) 15%, transparent);
}

.object-item-info {
    display: flex;
    gap: 0.35rem;
    align-items: baseline;
}

.object-item-label {
    font-weight: 500;
    font-size: 0.9rem;
}

.object-item-api {
    font-size: 0.8rem;
    color: var(--text-color-secondary);
}

.object-tag {
    font-size: 0.7rem;
}
</style>
