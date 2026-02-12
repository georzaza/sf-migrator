<script setup>
import { ref, computed } from 'vue';
import { useOrgStore } from '@/stores/orgStore';
import axiosInstance from '@/api/axiosInstance';

import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Select from 'primevue/select';

const orgStore = useOrgStore();
const visible = computed({
    get: () => orgStore.showAddOrgDialog,
    set: (val) => { if (!val) orgStore.showAddOrgDialog = false; }
});

const form = ref({
    name: '',
    description: '',
    loginURL: '',
    connectionType: 'Credentials',
    username: '',
    password: '',
    securityToken: '',
    clientId: '',
    clientSecret: ''
});

const connectionTypes = [
    { label: 'OAuth', value: 'OAuth' },
    { label: 'Credentials', value: 'Credentials' }
];

const credsError = ref(false);
const oauthError = ref(false);

function onClose() {
    orgStore.showAddOrgDialog = false;
}

async function onSave() {
    console.log('Saving org...');

    // Reset errors
    credsError.value = false;
    oauthError.value = false;

    const payload = {
        ...form.value,
        projectId: orgStore.selectedProject.id
    };

    try {
        const response = await axiosInstance.put('/api',
            payload,
            {
                headers: {
                    action: 'add-org',
                },
                withCredentials: true
            }
        );
        console.log('Response:', response.data.message);
        if (response.status === 201) {
            await orgStore.loadProjects();
            onClose();
        }
        else if (response.status === 400 && !response.data.success) {
            if (response.data.message === 'Validation error: Username, Password and SecurityToken are required for Credentials connection type.') {
                credsError.value = true;
            }
            else if (response.data.message === 'Validation error: ClientId and ClientSecret are required for OAuth connection type.') {
                console.log('HERE');
                oauthError.value = true;
            }
        }
        else {
            console.warn('Some error occured while adding the new org');
        }

        orgStore.closeAddProjectDialog();
    }
    catch (error) {
        console.error('Failed to add org:', error);
    }
}
</script>

<template>
    <Dialog v-model:visible="visible" header="Add Org" @hide="onClose" modal dismissableMask>
        <form id="add-org-form" @submit.prevent="onSave" class="add-org-form">
            <div class="fields-container">
                <div class="field-row">
                    <label for="org-name">Name*</label>
                    <InputText id="org-name" v-model="form.name" required />
                </div>
                <div class="field-row">
                    <label for="org-description">Description</label>
                    <InputText id="org-description" v-model="form.description" />
                </div>
                <div class="field-row">
                    <label for="org-loginURL">Login URL*</label>
                    <InputText id="org-loginURL" v-model="form.loginURL" required />
                </div>
                <div class="field-row">
                    <label for="org-connectionType">Connection Type*</label>
                    <Select
                        id="org-connectionType"
                        v-model="form.connectionType"
                        :options="connectionTypes"
                        optionLabel="label"
                        optionValue="value"
                        required
                    />
                </div>

                <!-- Creds -->
                <template v-if="form.connectionType === 'Credentials'">
                    <div class="field-row">
                        <label for="org-username">Username*</label>
                        <InputText
                            id="org-username"
                            v-model="form.username"
                            :class="{ 'input-error': credsError }"
                            placeholder="user@company.com"
                        />
                        <small class="field-help">Must be full email format (e.g., user@company-dev-ed.my.salesforce.com)</small>
                    </div>
                    <div class="field-row">
                        <label for="org-password">Password*</label>
                        <InputText id="org-password" v-model="form.password" type="password" :class="{ 'input-error': credsError }" />
                    </div>
                    <div class="field-row">
                        <label for="org-securityToken">Security Token*</label>
                        <InputText id="org-securityToken" v-model="form.securityToken" type="password" :class="{ 'input-error': credsError }" />
                        <small class="field-help">From Salesforce: Setup → My Personal Information → Reset Security Token</small>
                    </div>
                </template>

                <!-- OAuth -->
                <template v-else-if="form.connectionType === 'OAuth'">
                    <div class="field-row">
                        <label for="org-clientId">Client ID</label>
                        <InputText id="org-clientId" v-model="form.clientId" :class="{ 'input-error': oauthError }" />
                    </div>
                    <div class="field-row">
                        <label for="org-clientSecret">Client Secret</label>
                        <InputText id="org-clientSecret" v-model="form.clientSecret" type="password" :class="{ 'input-error': oauthError }" />
                    </div>
                </template>
            </div>
        </form>
        <template #footer>
            <Button label="Cancel" @click="onClose" class="p-button-text" />
            <Button label="Save" type="submit" form="add-org-form" />
        </template>
    </Dialog>
</template>

<style scoped>

.input-error {
    border: 1.5px solid #e53935 !important;
    background: #fff6f6 !important;
}

.add-org-form :deep(.p-inputtext.input-error),
.add-org-form :deep(.p-password-input.input-error),
.add-org-form :deep(input.input-error) {
    border: 1.5px solid #e53935 !important;
    background: #fff6f6 !important;
}

.add-org-form {
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
.field-help {
    color: var(--text-color-secondary);
    font-size: 0.8rem;
    margin-top: 0.25rem;
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
