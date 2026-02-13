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
 *   select-object - When an object is selected from dropdown
 */
import { ref, computed, watch } from 'vue';

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

const showCustomOnly = ref(false);
const selected = ref(props.selectedObject);

// Watch for prop changes
watch(() => props.selectedObject, (newVal) => {
    selected.value = newVal;
});

const filteredObjects = computed(() => {
    let result = props.objects;

    if (showCustomOnly.value) {
        result = result.filter(obj => obj.isCustom);
    }

    return result;
});

const dropdownOptions = computed(() => {
    const filtered = filteredObjects.value;
    if (selected.value && !filtered.find(obj => obj.id === selected.value.id)) {
        return [selected.value, ...filtered];
    }
    return filtered;
});

const objectCount = computed(() => {
    const total = props.objects.length;
    const filtered = filteredObjects.value.length;
    if (filtered === total) return `${total} objects`;
    return `${filtered} of ${total} objects`;
});

function onObjectSelect(event) {
    emit('select-object', event.value);
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
                <Dropdown
                    v-model="selected"
                    :options="dropdownOptions"
                    optionLabel="objectLabel"
                    :filter="true"
                    :filterFields="['objectName', 'objectLabel']"
                    placeholder="Select an object..."
                    class="object-dropdown"
                    @change="onObjectSelect"
                >
                    <template #item="slotProps">
                        <div class="object-dropdown-item">
                            <span class="object-item-label">{{ slotProps.item.objectLabel }}</span>
                            <span class="object-item-api">({{ slotProps.item.objectName }})</span>
                            <Tag
                                v-if="slotProps.item.isCustom"
                                value="Custom"
                                severity="info"
                                class="object-tag"
                            />
                        </div>
                    </template>
                </Dropdown>
                <div class="flex items-center gap-2">
                    <Checkbox v-model="showCustomOnly" :binary="true" inputId="customOnly" />
                    <label for="customOnly" class="text-sm">Custom only</label>
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

.object-dropdown {
    flex: 1;
}

.object-dropdown-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.object-item-label {
    font-weight: 500;
    font-size: 0.9rem;
}

.object-item-api {
    font-size: 0.8rem;
    color: var(--text-color-secondary);
    margin-left: 0.5rem;
}

.object-tag {
    font-size: 0.7rem;
}
</style>
