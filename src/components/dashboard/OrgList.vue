<script setup>
/**
 * OrgList - Displays orgs for a project with add/edit/delete actions.
 * Reusable: can be used in Dashboard and later in Migration Workspace.
 *
 * Props:
 *   orgs - Array of org objects to display
 *   selectedOrg - Currently selected org (for highlighting)
 *
 * Emits:
 *   select-org - When an org row is clicked
 *   add-org - When "Add Org" button is clicked
 *   edit-org - When edit button is clicked for an org
 *   delete-org - When delete button is clicked for an org
 *   open-org - When SF icon is clicked for an org
 */

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

function isSelected(org) {
    return props.selectedOrg?.id === org.id;
}
</script>

<template>
    <div class="org-list">
        <div class="org-list-header">
            <h3>Salesforce Orgs</h3>
            <Button
                icon="pi pi-plus"
                label="Add Org"
                outlined
                size="small"
                severity="success"
                @click="emit('add-org')"
            />
        </div>

        <div v-if="orgs.length === 0" class="org-list-empty">
            <i class="pi pi-inbox" style="font-size: 2rem; color: var(--text-color-secondary);"></i>
            <p>No orgs in this project yet.</p>
        </div>

        <div v-else class="org-items">
            <div
                v-for="org in orgs"
                :key="org.id"
                class="org-item"
                :class="{ 'org-item-selected': isSelected(org) }"
                @click="emit('select-org', org)"
            >
                <div class="org-item-info">
                    <span class="org-item-name">{{ org.name }}</span>
                    <span v-if="org.description" class="org-item-desc">{{ org.description }}</span>
                </div>
                <div class="org-item-actions">
                    <Button
                        icon="pi pi-pencil"
                        size="small"
                        severity="secondary"
                        text
                        rounded
                        @click.stop="emit('edit-org', org)"
                        v-tooltip.top="'Edit Org'"
                    />
                    <Button
                        icon="pi pi-trash"
                        size="small"
                        severity="danger"
                        text
                        rounded
                        @click.stop="emit('delete-org', org)"
                        v-tooltip.top="'Delete Org'"
                    />
                    <Button
                        icon = "pi pi-arrow-up-right"
                        size="small"
                        text
                        rounded
                        @click.stop="emit('open-org', org)"
                        v-tooltip.top="'Open Org'"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.org-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.org-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.org-list-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
}

.org-list-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem;
    color: var(--text-color-secondary);
}

.org-items {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.org-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.15s, border-color 0.15s;
}

.org-item:hover {
    background-color: var(--surface-hover);
}

.org-item-selected {
    background-color: var(--p-sky-50);
    border-color: var(--p-sky-500);
    border-width: 2px;
}

:root.app-dark .org-item-selected {
    background-color: color-mix(in srgb, var(--p-sky-500) 18%, transparent);
}

.org-item-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
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
}
</style>
