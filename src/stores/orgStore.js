import { defineStore } from 'pinia';
import axiosInstance from '@/api/axiosInstance';

export const useOrgStore = defineStore('orgs', {

    persist: true,

    state: () => ({
        projects: [],
        orgs: [],
        selectedProject: null,
        selectedOrg: null,
        showEditOrgDialog: false,
        showAddProjectDialog: false,
        showAddOrgDialog: false,
    }),

    getters: {
        projectOrgs: (state) => {
            if (!state.selectedProject) return [];
            return state.orgs.filter(org => org.projectId === state.selectedProject.id);
        },
    },

    actions: {
        setProjects(projects) {
            this.projects = projects;
        },

        setSelectedProject(project) {
            this.selectedProject = project;
            this.selectedOrg = null; // Clear org selection when project changes
        },

        setSelectedOrg(org) {
            this.selectedOrg = org;
        },

        closeEditOrgDialog() {
            this.showEditOrgDialog = false;
        },

        closeAddProjectDialog() {
            this.showAddProjectDialog = false;
        },

        closeAddOrgDialog() {
            this.showAddOrgDialog = false;
        },

        // Fetches projects AND orgs (full refresh).
        async loadProjects() {
            const response = await axiosInstance.get('/api', {
                headers: { 'action': 'get-projects' },
            });
            if (response.data.success) {
                this.projects = response.data.data;
                await this.loadOrgs();
            } else {
                console.error('Failed to load projects:', response.data.message);
            }
        },

        // Fetches only projects — use when orgs are unchanged (e.g. after add-project).
        async loadProjectsOnly() {
            const response = await axiosInstance.get('/api', {
                headers: { 'action': 'get-projects' },
            });
            if (response.data.success) {
                this.projects = response.data.data;
            } else {
                console.error('Failed to load projects:', response.data.message);
            }
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

        async updateProject(projectId, projectData) {
            const response = await axiosInstance.put('/api', projectData, {
                headers: {
                    action: 'update-project',
                    projectid: projectId,
                },
            });
            if (response.data.success) {
                // Patch in-place — no re-fetch needed, we already have the new data.
                const idx = this.projects.findIndex(p => p.id === projectId);
                if (idx !== -1) Object.assign(this.projects[idx], projectData);
                if (this.selectedProject?.id === projectId) Object.assign(this.selectedProject, projectData);
                return true;
            }
            return false;
        },

        async deleteProject(projectId) {
            const response = await axiosInstance.delete('/api', {
                headers: {
                    action: 'delete-project',
                    projectid: projectId,
                },
            });
            if (response.data.success) {
                this.projects = this.projects.filter(p => p.id !== projectId);
                this.orgs = this.orgs.filter(org => org.projectId !== projectId);
                if (this.selectedProject?.id === projectId) {
                    this.selectedProject = null;
                    this.selectedOrg = null;
                }
                return true;
            }
            return false;
        },
    },
});
