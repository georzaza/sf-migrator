<script setup>
import { computed } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useOrgStore } from '@/stores/orgStore';

const props = defineProps({
    selectedProject: {
        type: Object,
        default: null
    },
});

const emit = defineEmits(['create', 'edit', 'change']);

const orgStore = useOrgStore();
const confirm = useConfirm();
const toast = useToast();

const selectedProjectModel = computed({
    get: () => orgStore.selectedProject,
    set: (val) => orgStore.setSelectedProject(val),
});

function onDeleteProject() {
    if (!props.selectedProject) return;
    const project = props.selectedProject;
    confirm.require({
        message: `Are you sure you want to delete "${project.name}"? All orgs in this project will also be deleted. This cannot be undone.`,
        header: 'Confirm Delete Project',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Delete',
        rejectLabel: 'Cancel',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                const success = await orgStore.deleteProject(project.id);
                if (success) {
                    toast.add({ severity: 'success', summary: 'Deleted', detail: `Project "${project.name}" and its orgs have been deleted.`, life: 3000 });
                } else {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete project.', life: 3000 });
                }
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to delete project.', life: 3000 });
            }
        },
    });
}
</script>

<template>
    <div class="dashboard-panel project-panel">
        <div class="project-list-header">
            <h3>Projects</h3>
            <Select
                v-model="selectedProjectModel"
                :options="orgStore.projects"
                optionLabel="name"
                placeholder="Select Project"
                class="project-select"
                @change="emit('change', $event.value)"
            />
            <Button
                icon="pi pi-plus"
                label="Add Project"
                size="small"
                severity="success"
                outlined
                @click="emit('create')"
            />
        </div>

        <!-- Selected project card -->
        <div v-if="selectedProject" class="project-item">
            <div class="project-item-info">
                <span class="project-item-name">{{ selectedProject.name }}</span>
                <span v-if="selectedProject.description" class="project-item-desc">{{ selectedProject.description }}</span>
            </div>
            <div class="project-item-actions">
                <Button
                    icon="pi pi-pencil"
                    size="small"
                    severity="secondary"
                    text
                    rounded
                    v-tooltip.top="'Edit Project'"
                    @click="emit('edit')"
                />
                <Button
                    icon="pi pi-trash"
                    size="small"
                    severity="danger"
                    text
                    rounded
                    v-tooltip.top="'Delete Project'"
                    @click="onDeleteProject"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
.project-panel {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.project-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
}

.project-list-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    white-space: nowrap;
}

.project-select {
    flex: 1;
    min-width: 0;
}

.project-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border: 2px solid;
    border-color: var(--p-sky-500);
    border-radius: 8px;
    background-color: var(--p-sky-50);
}

:root.app-dark .project-item {
    background-color: color-mix(in srgb, var(--p-sky-500) 18%, transparent);
}

.project-item-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
    min-width: 0;
}

.project-item-name {
    font-weight: 500;
}

.project-item-desc {
    font-size: 0.85rem;
    color: var(--text-color-secondary);
}

.project-item-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
}
</style>
