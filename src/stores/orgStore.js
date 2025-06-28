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
                        items: [], // could perhaps add action items, e.g. analyze org, set as source org, etc.
                        command: () => {
                            // todo fill in accordingly
                        },
                    })),
                command: () => {
                    // todo fill in accordingly
                },
            }));

            this.menuItems = [
                {
                    key: 'projects-and-orgs',
                    label: 'Projects and Orgs',
                    items: {...projectsAndOrgs},
                },
            ];

        }
    },
});

