<script setup>
import { ref, watch, computed } from 'vue';
import { useOrgStore } from '@/stores/orgStore';
import axiosInstance from '@/api/axiosInstance';

import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Select from 'primevue/select';
import Button from 'primevue/button';

const orgStore = useOrgStore();
const visible = computed({
    get: () => orgStore.showEditOrgDialog,
    set: (val) => { if (!val) orgStore.closeEditOrgDialog(); }
});

const connectionTypes = [
    { label: 'OAuth', value: 'OAuth' },
    { label: 'Credentials', value: 'Credentials' }
];

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

watch(() => orgStore.selectedOrg, (org) => {
    console.log('Selected org changed:', org);
    if (org) {
        form.value = {
            name: org.name || '',
            description: org.description || '',
            loginURL: org.loginURL || '',
            connectionType: org.connectionType || 'Credentials',
            username: '',
            password: '',
            securityToken: '',
            clientId: '',
            clientSecret: ''
        };
    }
}, { immediate: true });

function onClose() {
    orgStore.closeEditOrgDialog();
}

async function onSave() {
    console.log('Saving org...');
    try {
        const payload = { ...form.value };

         ['clientId', 'clientSecret', 'password', 'username', 'securityToken']
         .forEach(key => {
            if (!payload[key]) {
                delete payload[key];
            }
        });

        await axiosInstance.put('/api',
            payload,
            {
                headers: {
                    action: 'update-org',
                    orgid: orgStore.selectedOrg.id
                },
                withCredentials: true
            }
        );

        await orgStore.loadProjects();

        orgStore.closeEditOrgDialog();
    }
    catch (error) {
        console.error('Failed to update org:', error);
    }
    console.log('Org saved!');
}
</script>


<template>
    <Dialog v-model:visible="visible" header="Edit Org Info" @hide="onClose" modal dismissableMask>
        <form id="form" @submit.prevent="onSave" class="edit-org-form">
            <div class="fields-container">
                <div class="field-row">
                    <label for="org-name">Name*</label>
                    <InputText id="org-name" v-model="form.name" required />
                </div>
                <div class="field-row">
                    <label for="org-description">Description</label>
                    <Textarea id="org-description" v-model="form.description" autoResize />
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

                <!-- Credentials -->
                <template v-if="form.connectionType === 'Credentials'">
                    <div class="field-row">
                        <label for="org-username">Username*</label>
                        <InputText id="org-username" placeholder="user@company.com" v-model="form.username" />
                        <small class="field-help">Must be full email format (e.g., user@company-dev-ed.my.salesforce.com)</small>
                    </div>
                    <div class="field-row">
                        <label for="org-password">Password*</label>
                        <Password id="org-password" placeholder="New Password" v-model="form.password" type="password" :toggleMask="true" fluid :feedback="false" />
                    </div>
                    <div class="field-row">
                        <label for="org-securityToken">Security Token*</label>
                        <Password id="org-securityToken" placeholder="New Security Token" v-model="form.securityToken" type="password" :toggleMask="true" fluid :feedback="false" />
                        <small class="field-help">From Salesforce: Setup → My Personal Information → Reset Security Token</small>
                    </div>
                </template>

                <!-- OAuth -->
                <template v-else-if="form.connectionType === 'OAuth'">
                    <div class="field-row">
                        <label for="org-clientId">Client ID</label>
                        <InputText id="org-clientId" placeholder="New Client ID" v-model="form.clientId" />
                    </div>
                    <div class="field-row">
                        <label for="org-clientSecret">Client Secret</label>
                        <Password id="org-clientSecret" placeholder="New Client Secret" v-model="form.clientSecret" type="password" :toggleMask="true" fluid :feedback="false" />
                    </div>
                </template>
            </div>
        </form>
        <template #footer>
            <Button label="Cancel" @click="onClose" class="p-button-text" />
            <Button label="Save" type="submit" form="form"/>
        </template>
    </Dialog>
</template>


<style scoped>
.edit-org-form {
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

.p-inputtext,
.p-dropdown,
.p-textarea {
    width: 100%;
}

.p-dialog .p-dialog-content {
    padding-bottom: 0;
}

.pi-eye {
    transform: scale(1.6);
    margin-right: 1rem;
}

.pi-eye-slash {
    transform: scale(1.6);
    margin-right: 1rem;
}
</style>
