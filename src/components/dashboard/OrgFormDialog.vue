<script setup>
/**
 * OrgFormDialog - Unified add/edit org modal.
 * Replaces both AddOrgDialog and EditOrgDialog.
 *
 * Props:
 *   visible - Controls dialog visibility
 *   org - Org object to edit (null = add mode)
 *   projectId - Project ID for new orgs
 *
 * Emits:
 *   update:visible - v-model for visibility
 *   saved - After successful save/update
 */
import { ref, watch, computed } from 'vue';
import axiosInstance from '@/api/axiosInstance';
import { useOrgStore } from '@/stores/orgStore';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false,
    },
    org: {
        type: Object,
        default: null,
    },
    projectId: {
        type: String,
        default: null,
    },
});

const emit = defineEmits(['update:visible', 'saved']);

const orgStore = useOrgStore();
const isEditMode = computed(() => !!props.org);
const dialogHeader = computed(() => isEditMode.value ? 'Edit Org' : 'Add New Org');

const defaultForm = () => ({
    name: '',
    description: '',
    loginURL: '',
    clientId: '',
    clientSecret: '',
});

const form = ref(defaultForm());
const saving = ref(false);
const errorMessage = ref('');
const urlError = ref('');

const SF_URL_REGEX = /^https:\/\/.+\.my\.salesforce\.com$/;

function validateUrl(url) {
    if (!url) {
        urlError.value = '';
        return true;
    }
    if (!SF_URL_REGEX.test(url.trim())) {
        urlError.value = 'Must start with https:// and end with .my.salesforce.com';
        return false;
    }
    urlError.value = '';
    return true;
}

watch(() => props.visible, (val) => {
    if (val) {
        errorMessage.value = '';
        urlError.value = '';
        if (props.org) {
            // Edit mode: pre-fill with org data, leave credentials blank
            form.value = {
                name: props.org.name || '',
                description: props.org.description || '',
                loginURL: props.org.loginURL || '',
                clientId: '',
                clientSecret: '',
            };
        } else {
            form.value = defaultForm();
        }
    }
});

function onClose() {
    emit('update:visible', false);
}

async function onSave() {
    if (!validateUrl(form.value.loginURL)) return;
    saving.value = true;
    errorMessage.value = '';

    try {
        if (isEditMode.value) {
            // Update existing org
            const payload = { ...form.value };
            // Strip empty credential fields so we don't overwrite with blanks
            ['clientId', 'clientSecret']
                .forEach(key => {
                    if (!payload[key]) delete payload[key];
                });

            const response = await axiosInstance.put('/api', payload, {
                headers: {
                    action: 'update-org',
                    orgid: props.org.id,
                },
            });
            if (response.data.success) {
                // Patch store in-place — no re-fetch needed.
                const idx = orgStore.orgs.findIndex(o => o.id === props.org.id);
                if (idx !== -1) Object.assign(orgStore.orgs[idx], payload);
                if (orgStore.selectedOrg?.id === props.org.id) Object.assign(orgStore.selectedOrg, payload);
                emit('saved');
                onClose();
            } else {
                errorMessage.value = response.data.message || 'Failed to update org';
            }
        } else {
            // Create new org
            const payload = {
                ...form.value,
                projectId: props.projectId,
            };

            const response = await axiosInstance.put('/api', payload, {
                headers: { action: 'add-org' },
            });
            if (response.status === 201) {
                // New org has a server-generated ID — refetch orgs only (projects unchanged).
                await orgStore.loadOrgs();
                emit('saved');
                onClose();
            } else if (response.status === 400) {
                errorMessage.value = response.data.message || 'Validation error';
            } else {
                errorMessage.value = 'Failed to add org';
            }
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
        :header="dialogHeader"
        modal
        dismissableMask
        :style="{ width: '500px' }"
    >
        <form id="org-form" @submit.prevent="onSave" class="org-form">
            <Message v-if="errorMessage" severity="error" :closable="false" class="mb-3">
                {{ errorMessage }}
            </Message>

            <div class="fields-container">
                <div class="field-row">
                    <label for="org-name">Name *</label>
                    <InputText id="org-name" v-model="form.name" required />
                </div>
                <div class="field-row">
                    <label for="org-description">Description</label>
                    <Textarea id="org-description" v-model="form.description" autoResize rows="2" />
                </div>
                <div class="field-row">
                    <label for="org-loginURL">Instance URL *</label>
                    <InputText
                        id="org-loginURL"
                        v-model="form.loginURL"
                        required
                        placeholder="https://your-org.my.salesforce.com"
                        @blur="validateUrl(form.loginURL)"
                        :invalid="!!urlError"
                    />
                    <small v-if="urlError" class="field-error">{{ urlError }}</small>
                    <small v-else class="field-help">Must end in .my.salesforce.com</small>
                </div>

                <div class="field-row">
                    <label for="org-clientId">Client ID {{ isEditMode ? '' : '*' }}</label>
                    <InputText
                        id="org-clientId"
                        v-model="form.clientId"
                        :placeholder="isEditMode ? 'Leave blank to keep current' : 'Client ID'"
                        :required="!isEditMode"
                    />
                </div>

                <div class="field-row">
                    <label for="org-clientSecret">Client Secret {{ isEditMode ? '' : '*' }}</label>
                    <Password
                        id="org-clientSecret"
                        v-model="form.clientSecret"
                        :placeholder="isEditMode ? 'Leave blank to keep current' : 'Client Secret'"
                        :toggleMask="true"
                        :required="!isEditMode"
                        fluid
                        :feedback="false"
                    />
                </div>
            </div>
        </form>

        <template #footer>
            <Button label="Cancel" @click="onClose" severity="secondary" text />
            <Button
                :label="isEditMode ? 'Save' : 'Create'"
                type="submit"
                form="org-form"
                :loading="saving"
            />
        </template>
    </Dialog>
</template>

<style scoped>
.org-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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
    margin-top: 0.15rem;
}

.field-error {
    color: var(--red-500, #ef4444);
    font-size: 0.8rem;
    margin-top: 0.15rem;
}

label {
    font-weight: 500;
    font-size: 0.9rem;
}
</style>
