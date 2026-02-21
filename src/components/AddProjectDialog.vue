<script setup>
import { ref, computed } from 'vue';
import { useOrgStore } from '@/stores/orgStore';
import axiosInstance from '@/api/axiosInstance';

import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';

const orgStore = useOrgStore();
const visible = computed({
    get: () => orgStore.showAddProjectDialog,
    set: (val) => { if (!val) orgStore.showAddProjectDialog = false; }
});

const form = ref({
    name: '',
    description: ''
});

function onClose() {
    orgStore.showAddProjectDialog = false;
}

async function onSave() {
    console.log('Saving project...');

    try {
        const response = await axiosInstance.put('/api',
            {
                name: form.value.name,
                description: form.value.description
            },
            {
                headers: {
                    action: 'add-project',
                },
                withCredentials: true
            }
        );

        if (response.status === 201) {
            // New project has a server-generated ID — fetch projects only (orgs unchanged).
            await orgStore.loadProjectsOnly();
            onClose();
        }
        else {
            console.warn('Some error occured while adding the new project');
        }

        orgStore.closeAddProjectDialog();
    }
    catch (error) {
        console.error('Failed to add project:', error);
    }
}

</script>

<template>
    <Dialog v-model:visible="visible" header="Add Project" @hide="onClose" modal dismissableMask>
        <form id="add-project-form" @submit.prevent="onSave" class="add-project-form">
            <div class="fields-container">
                <div class="field-row">
                    <label for="project-name">Name*</label>
                    <InputText id="project-name" v-model="form.name" required />
                </div>
                <div class="field-row">
                    <label for="project-description">Description</label>
                    <InputText id="project-description" v-model="form.description" />
                </div>
            </div>
        </form>
        <template #footer>
            <Button label="Cancel" @click="onClose" class="p-button-text" />
            <Button label="Save" type="submit" form="add-project-form" />
        </template>
    </Dialog>
</template>

<style scoped>
.add-project-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 350px;
    max-width: 500px;
    margin: 0 auto;
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
    color: #333;
}
.p-inputtext {
    width: 100%;
}
</style>
