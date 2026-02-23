import { defineStore } from 'pinia';
import axiosInstance from '@/api/axiosInstance';

export const useOrgStore = defineStore('orgs', {

    persist: true,

    state: () => ({
        orgs: [],
        selectedOrg: null,
        showEditOrgDialog: false,
        showAddOrgDialog: false,
    }),

    actions: {
        setSelectedOrg(org) {
            this.selectedOrg = org;
        },

        closeEditOrgDialog() {
            this.showEditOrgDialog = false;
        },

        closeAddOrgDialog() {
            this.showAddOrgDialog = false;
        },

        async loadOrgs() {
            const response = await axiosInstance.get('/api',
                {
                    headers: {
                        'action': 'get-orgs',
                    },
                }
            );
            if (response.data.success) {
                this.orgs = response.data.data;
                return true;
            }
            else {
                console.error('Failed to load Salesforce Orgs:', response.data.message);
                return false;
            }
        },

        async deleteOrg(orgId) {
            const response = await axiosInstance.delete('/api', {
                headers: {
                    action: 'delete-org',
                    orgid: orgId,
                },
            });
            if (response.data.success) {
                this.orgs = this.orgs.filter(org => org.id !== orgId);
                if (this.selectedOrg?.id === orgId) {
                    this.selectedOrg = null;
                }
                return true;
            }
            return false;
        },

        async getOrgStats(orgId) {
            const response = await axiosInstance.get('/api', {
                headers: {
                    action: 'get-org-stats',
                    orgid: orgId,
                },
            });
            if (response.data.success) {
                return response.data.data;
            } else {
                console.error('Failed to get org stats:', response.data.message);
                return null;
            }
        },
    }
});
