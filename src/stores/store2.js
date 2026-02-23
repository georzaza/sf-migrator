import { defineStore } from 'pinia';
import piniaPersist from 'pinia-plugin-persistedstate';
import configs from './assets/configs/configs.json';
import boltIcon from './assets/bolt-icon.png';

export const useGlobalStore = defineStore('global', {
    // Add the persist plugin correctly here
    persist: true,

    state: () => ({
        loggedInUser: null,
        project: {},
        analyseStatus: [],
        selectedL1: null,
        selectedL2: null,
        allProjectsAndOrgs: [],
        capabilities: [],
        collapseMenuItems: false,
        isTouchScreenDevice: false,
        disabledCapabilities: [
            'Contract & Order Management',
            'Marketing & Omni-Channel',
            'Coaching',
            'Master Data',
            'Reporting & Monitoring'
        ],
    }),

    actions: {
        async loadCapabilities(router) {
            /** Store IQVIA Capabilities in global state */

            //Initialize Capabilities from the capabilities configuration for the Side Menu and store them in the global state
            const capabilitiesConfig = await fetch(configs.LOCAL_HOST, {headers: {action: 'get capabilities config'}})
            const capabilities = await capabilitiesConfig.json();

            // Map L2 capabilities to the menu items format
            const mapL2Capabilities = (l1, l2) => {
                const target = l1.toLowerCase().replace(/&/g, "").replace(/\s+/g, "-")
                const selectedL2 = l2.name.toLowerCase().replace(/&/g, "").replace(/\s+/g, "-")
                return {
                    label: l2.name,
                    key: selectedL2,
                    level: 5,
                    command: () => {
                        this.selectedL2 = selectedL2
                        router.push({
                            name: target,
                            params: {capabilityL1: l1, capabilityNameL2: l2}
                        }).then(() => {
                            setTimeout(() => {
                                // After navigating, scroll to the specific section
                                const element = document.getElementById(selectedL2)
                                if (element) {
                                    const elementPosition = element.getBoundingClientRect().top + window.scrollY;
                                    const offset = 70
                                    window.scrollTo({
                                        top: elementPosition - offset,
                                        behavior: 'smooth'
                                    });
                                } else {
                                    console.log('No element with ID: ', selectedL2);
                                }
                            }, 500);
                        })
                    }
                }
            }

            // Map L1 capabilities to the menu items format
            const mapL1Capabilities = (cap) => {
                const selectedL1 = cap.L1Capability.toLowerCase().replace(/&/g, "").replace(/\s+/g, "-")
                return {
                    label: cap.L1Capability,
                    key: selectedL1,
                    level: 4,
                    items: cap.L2Capabilities?.map(l2 => mapL2Capabilities(cap.L1Capability, l2)),
                    //icon: 'fas fa-bolt fa-xs',
                    //icon: 'fab fa-sistrix',
                    //icon: 'far fa-th',
                    //icon: 'fab fa-searchengin',
                    icon: boltIcon,
                    isImageIcon: true,
                    disabled: this.disabledCapabilities.includes(cap.L1Capability),
                    command: () => {
                        this.selectedL1 = selectedL1
                    }
                }
            };

            this.capabilities = capabilities[0].map(mapL1Capabilities);
        },
        // Set project and organization names
        setProjectAndOrgNames(prname, prid, orgname, orgid) {
            this.project = { prname, prid, orgname, orgid };
        },

        // Set logged in user
        setLoggedInUser(firstName, lastName, email) {
            this.loggedInUser = { firstName, lastName, email };
        },

        initAnalyseStatuses(orgs) {
            orgs.forEach(org => {
                this.analyseStatus.push({orgId: org.key, showResults: false, isLoading: false, progressBar: 0});
            });
        },

        getAnalyseStatuses() {
            return this.analyseStatus;
        },

        // Get project and organization names
        getProjectAndOrgNames() {
            return this.project;
        },

        // Get logged in email
        getLoggedInUser() {
            return this.loggedInUser;
        },
    },
});
