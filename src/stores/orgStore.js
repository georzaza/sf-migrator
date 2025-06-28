import { defineStore } from 'pinia';
import axiosInstance from '@/api/axiosInstance';

export const useOrgStore = defineStore('orgs', {

    persist: {
        paths: ['projects', 'orgs', 'selectedProject', 'selectedOrg', 'orgToEdit'],
    },

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

        closeEditOrgDialog() {
            this.showEditOrgDialog = false;
            this.orgToEdit = null;
        },

        async loadProjects() {
            const response = await axiosInstance.get('/',
                {
                    headers: {
                        'action': 'get-projects',
                    },
                }
            );
            if (response.data.success) {
                this.projects = response.data.data;
                const loadedOrgs = await this.loadOrgs();
                if (!loadedOrgs) {
                    console.error('Failed to load Salesforce Orgs');
                }
                this.setMenuItems();
            }
            else {
                console.error('Failed to load projects:', response.data.message);
            }
        },

        async loadOrgs() {
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
                                    this.selectedOrg = org;
                                    this.selectedProject = project;
                                    this.showEditOrgDialog = true;
                                    this.orgToEdit = this.selectedOrg;
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

