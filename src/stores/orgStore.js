import { defineStore } from 'pinia';
import axiosInstance from '@/api/axiosInstance';

export const useOrgStore = defineStore('orgs', {

    persist: true,

    state: () => ({
        projects: [],
        orgs: [],
        selectedProject: null,
        selectedOrg: null,
        menuItems: [],
        showEditOrgDialog: false,
        orgToEdit: null,
    }),

    actions: {
        setProjects(projects) {
            this.projects = projects;
        },

        setSelectedProject(project) {
            this.selectedProject = project;
        },

        setSelectedOrg(org) {
            this.selectedOrg = org;
        },

        openEditOrgDialog(org, project) {
            // need to ensure we get the latest org/project from the store (e.g. for after 'Edit' dialog)
            const freshOrg = this.orgs.find(o => o.id === org.id) || org;
            const freshProject = this.projects.find(p => p.id === project.id) || project;
            this.orgToEdit = { ...freshOrg, project: freshProject };
            this.showEditOrgDialog = true;
        },

        closeEditOrgDialog() {
            this.showEditOrgDialog = false;
            this.orgToEdit = null;
        },

        async loadProjects() {
            console.log('Loading projects...');
            const response = await axiosInstance.get('/',
                {
                    headers: {
                        'action': 'get-projects',
                    },
                }
            );
            if (response.data.success) {
                this.projects = response.data.data;
                if (!this.loadOrgs()) {
                    console.error('Failed to load Salesforce Orgs');
                }
                this.setMenuItems();
            }
            else {
                console.error('Failed to load projects:', response.data.message);
            }
        },

        async loadOrgs() {
            console.log('Loading  Orgs...');
            const response = await axiosInstance.get('/',
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

        setMenuItems() {
            console.log('Setting menu items...');
            const projectsAndOrgs = this.projects.map(project => ({
                key: project.id,
                label: project.name,
                icon: null, // todo maybe different icon to differentiate from orgs
                to: null, // todo correct after route handling is done
                items: this.orgs
                    .filter(org => org.projectId === project.id)
                    .map(org => ({
                        key: project.id + '-' + org.id,
                        label: org.name,
                        icon: null, // todo maybe if org is analyzed a green, if not a red icon
                        //url: org.loginURL || null, // todo review if needed
                        //target: org.loginURL ? '_blank' : null, //todo review
                        to: null, // todo correct after route handling is done
                        items: [
                            {
                                key: project.id + '-' + org.id + '-edit',
                                label: 'Edit Org Info',
                                icon: 'mdi-pencil',
                                to: null, // todo correct after route handling is done
                                command: () => {
                                    // todo fill in accordingly
                                    this.selectedOrg = org;
                                    this.selectedProject = project;
                                    // need to ensure we get the latest org/project from the store (e.g. for after 'Edit' dialog)
                                    const freshOrg = this.orgs.find(o => o.id === org.id);
                                    const freshProject = this.projects.find(p => p.id === project.id);
                                    this.openEditOrgDialog(freshOrg, freshProject);
                                },
                            },
                            {
                                key: project.id + '-' + org.id + '-delete',
                                label: 'Delete Org',
                                icon: 'mdi-delete',
                                to: null, // todo correct after route handling is done
                                command: () => {
                                    // todo fill in accordingly
                                    this.selectedOrg = org;
                                    this.selectedProject = project;
                                },
                            },
                            {
                                key: project.id + '-' + org.id + '-analyze',
                                label: 'Start Analysis',
                                icon: 'mdi-chart-line',
                                to: null, // todo correct after route handling is done
                                command: () => {
                                    // todo fill in accordingly
                                    this.selectedOrg = org;
                                    this.selectedProject = project;
                                },
                            },
                            {
                                key: project.id + '-' + org.id + '-openOrg',
                                label: 'Open Org',
                                icon: 'mdi-open-in-new',
                                url: org.loginURL || null,
                                target: org.loginURL ? '_blank' : null,
                                command: () => {
                                    // todo fill in accordingly
                                    this.selectedOrg = org;
                                    this.selectedProject = project;
                                },
                            },
                        ],
                        command: () => {
                            // todo fill in accordingly
                            this.selectedOrg = org;
                            this.selectedProject = project;
                        },
                    })),
                command: () => {
                    // todo fill in accordingly
                    this.selectedOrg = null;
                    this.selectedProject = project;
                },
            }));

            this.menuItems = [
                {
                    key: 'projects-and-orgs',
                    label: 'Your Projects and Orgs',
                    items: projectsAndOrgs,
                },
            ];

        }
    },
});

