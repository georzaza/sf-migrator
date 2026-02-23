<script setup>
/**
 * OrgList - Displays orgs for a project with add/edit/delete/open actions.
 * Mirrors the look and behavior of ProjectPanel.
 *
 * Props:
 *   orgs - Array of org objects
 *   selectedOrg - Currently selected org
 *
 * Emits:
 *   select-org - When an org is chosen from the dropdown
 *   add-org - When "Add Org" button is clicked
 *   edit-org - When edit button is clicked
 *   delete-org - When delete button is clicked
 *   open-org - When open button is clicked
 */
import { computed } from 'vue';

const props = defineProps({
    orgs: {
        type: Array,
        default: () => [],
    },
    selectedOrg: {
        type: Object,
        default: null,
    },
});

const emit = defineEmits(['select-org', 'add-org', 'edit-org', 'delete-org', 'open-org']);

const selected = computed({
    get: () => props.selectedOrg,
    set: (val) => emit('select-org', val),
});
</script>

<template>
    <div class="org-list">
        <div class="org-list-header">
            <h3>Orgs</h3>
            <Select
                v-model="selected"
                :options="orgs"
                optionLabel="name"
                placeholder="Select Org"
                class="org-select"
            />
            <Button
                icon="pi pi-plus"
                label="Add Org"
                size="small"
                severity="success"
                outlined
                @click="emit('add-org')"
            />
        </div>

        <!-- Selected org card -->
        <div v-if="selectedOrg" class="org-item">
            <div class="org-item-info">
                <span class="org-item-name">{{ selectedOrg.name }}</span>
                <span v-if="selectedOrg.description" class="org-item-desc">{{ selectedOrg.description }}</span>
            </div>
            <div class="org-item-actions">
                <Button
                    icon="pi pi-pencil"
                    size="small"
                    severity="secondary"
                    text
                    rounded
                    v-tooltip.top="'Edit Org'"
                    @click="emit('edit-org', selectedOrg)"
                />
                <Button
                    icon="pi pi-trash"
                    size="small"
                    severity="danger"
                    text
                    rounded
                    v-tooltip.top="'Delete Org'"
                    @click="emit('delete-org', selectedOrg)"
                />
                <Button
                    icon="pi pi-arrow-up-right"
                    size="small"
                    text
                    rounded
                    v-tooltip.top="'Open Org'"
                    @click="emit('open-org', selectedOrg)"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
.org-list {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.org-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
}

.org-list-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    white-space: nowrap;
}

.org-select {
    flex: 1;
    min-width: 0;
}

.org-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border: 2px solid;
    border-color: var(--p-sky-500);
    border-radius: 8px;
    background-color: var(--p-sky-50);
}

:root.app-dark .org-item {
    background-color: color-mix(in srgb, var(--p-sky-500) 18%, transparent);
}

.org-item-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
    min-width: 0;
}

.org-item-name {
    font-weight: 500;
}

.org-item-desc {
    font-size: 0.85rem;
    color: var(--text-color-secondary);
}

.org-item-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
}
</style>
