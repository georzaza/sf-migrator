<script setup>
/**
 * EditProjectDialog - Edit project name and description.
 *
 * Props:
 *   visible - Controls dialog visibility
 *   project - Project object to edit
 *
 * Emits:
 *   update:visible - v-model for visibility
 *   saved - After successful save
 */
import { ref, watch } from 'vue';
import { useOrgStore } from '@/stores/orgStore';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false,
    },
    project: {
        type: Object,
        default: null,
    },
});

const emit = defineEmits(['update:visible', 'saved']);

const orgStore = useOrgStore();
const toast = useToast();

const form = ref({ name: '', description: '' });
const saving = ref(false);
const errorMessage = ref('');

watch(() => props.visible, (val) => {
    if (val && props.project) {
        errorMessage.value = '';
        form.value = {
            name: props.project.name || '',
            description: props.project.description || '',
        };
    }
});

function onClose() {
    emit('update:visible', false);
}

async function onSave() {
    if (!form.value.name.trim()) {
        errorMessage.value = 'Project name is required';
        return;
    }
    saving.value = true;
    errorMessage.value = '';

    try {
        const success = await orgStore.updateProject(props.project.id, {
            name: form.value.name,
            description: form.value.description,
        });
        if (success) {
            toast.add({ severity: 'success', summary: 'Updated', detail: 'Project updated successfully.', life: 3000 });
            emit('saved');
            onClose();
        } else {
            errorMessage.value = 'Failed to update project';
        }
    } catch (error) {
        errorMessage.value = error.response?.data?.message || error.message || 'An error occurred';
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Dialog
        :visible="visible"
        @update:visible="emit('update:visible', $event)"
        header="Edit Project"
        modal
        dismissableMask
        :style="{ width: '450px' }"
    >
        <form id="edit-project-form" @submit.prevent="onSave" class="edit-project-form">
            <Message v-if="errorMessage" severity="error" :closable="false" class="mb-3">
                {{ errorMessage }}
            </Message>

            <div class="fields-container">
                <div class="field-row">
                    <label for="edit-project-name">Name *</label>
                    <InputText id="edit-project-name" v-model="form.name" required />
                </div>
                <div class="field-row">
                    <label for="edit-project-description">Description</label>
                    <Textarea id="edit-project-description" v-model="form.description" autoResize rows="3" />
                </div>
            </div>
        </form>

        <template #footer>
            <Button label="Cancel" severity="secondary" text @click="onClose" />
            <Button label="Save" type="submit" form="edit-project-form" :loading="saving" />
        </template>
    </Dialog>
</template>

<style scoped>
.edit-project-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 300px;
}
.fields-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
.field-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}
label {
    font-weight: 500;
    margin-bottom: 0.1rem;
}
</style>
