import { defineStore } from 'pinia';
import axiosInstance from '@/api/axiosInstance';
import salesforceLogo from '../../assets/logos/Salesforce.com_logo.svg.png';

export const useOrgStore = defineStore('orgs', {

    persist: true,

    state: () => ({
        projects: [],
        orgs: [],
        selectedProject: null,
        selectedOrg: null,
        menuItems: [],
        showEditOrgDialog: false,
        showAddProjectDialog: false,
        showAddOrgDialog: false,
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
            this.selectedOrg = null;
        },

        closeAddProjectDialog() {
            this.showAddProjectDialog = false;
        },

        closeAddOrgDialog() {
            this.showAddOrgDialog = false;
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

            const addProjectButton = {
                key: 'add-project',
                label: 'Add Project',
                icon: 'pi pi-plus',
                styleClass: 'menu-action-highlight', // use the custom highlight class
                command: () => {
                    this.showAddProjectDialog = true; // open Add Project dialog
                },
            };

            const projectsAndOrgs = this.projects.map(project => {

                const migrateButton = {
                    key: project.id + '_migrate',
                    label: 'Start Migration',
                    icon: 'pi pi-arrow-right-arrow-left',
                    styleClass: 'menu-action-highlight',
                    to: `/migrate/${project.id}`,
                    command: () => {
                        this.selectedProject = project;
                    },
                };

                const addOrgButton = {
                    key: project.id + '_add-org',
                    label: 'Add Org',
                    icon: 'pi pi-plus',
                    styleClass: 'menu-action-highlight', // use the custom highlight class
                    command: () => {
                        this.selectedProject = project;
                        this.showAddOrgDialog = true; // open Add Org dialog
                    },
                };

                const orgItems = this.orgs.filter(org => org.projectId === project.id).map(org => ({
                    key: project.id + '_' + org.id,
                    label: org.name,
                    icon: null, // todo maybe if org is analyzed a green, if not a red icon
                    //url: org.loginURL || null, // todo review if needed
                    //target: org.loginURL ? '_blank' : null, //todo review
                    to: null, // todo correct after route handling is done
                    items: [
                        {
                            key: project.id + '_' + org.id + '_edit',
                            label: 'Edit Org Info',
                            icon: 'pi pi-pencil',
                            to: null, // todo correct after route handling is done
                            command: () => {
                                this.selectedOrg = org;
                                this.selectedProject = project;
                                this.showEditOrgDialog = true;
                            },
                        },
                        {
                            key: project.id + '_' + org.id + '_delete',
                            label: 'Delete Org',
                            icon: 'pi pi-times',
                            to: null, // todo correct after route handling is done
                            command: () => {
                                // todo fill in accordingly
                                this.selectedOrg = org;
                                this.selectedProject = project;
                            },
                        },
                        {
                            key: project.id + '_' + org.id + '_analyze',
                            label: 'Start Analysis',
                            icon: 'pi pi-cloud-download',
                            to: null, // todo correct after route handling is done
                            command: () => {
                                // todo fill in accordingly
                                this.selectedOrg = org;
                                this.selectedProject = project;
                            },
                        },
                        {
                            key: project.id + '_' + org.id + '_openOrg',
                            label: 'Open Org',
                            imgIcon: salesforceLogo,
                            url: org.loginURL || null,
                            target: org.loginURL ? '_blank' : null,
                            command: () => {
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
                }));

                return {
                    key: project.id,
                    label: project.name,
                    icon: null, // todo maybe different icon to differentiate from orgs
                    to: null, // todo correct after route handling is done
                    items: [migrateButton, addOrgButton, ...orgItems],
                    command: () => {
                        // todo fill in accordingly
                        this.selectedOrg = null;
                        this.selectedProject = project;
                    },
                };
            });

            this.menuItems = [
                {
                    key: 'projects-and-orgs',
                    label: 'Your Projects and Orgs',
                    items: [addProjectButton, ...projectsAndOrgs],
                },
            ];
        }
    },
});

