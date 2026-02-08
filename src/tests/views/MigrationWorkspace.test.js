/**
 * MigrationWorkspace Component Tests
 *
 * Tests for the main migration interface view
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MigrationWorkspace from '@/views/MigrationWorkspace.vue';
import { useOrgStore } from '@/stores/orgStore';
import { useMetadataStore } from '@/stores/metadataStore';
import { useMappingStore } from '@/stores/mappingStore';

// Mock the router
vi.mock('vue-router', () => ({
    useRoute: () => ({
        params: { projectId: 'project-1' }
    })
}));

// Mock axios
import axiosInstance from '@/api/axiosInstance';
vi.mock('@/api/axiosInstance', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
        put: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
        post: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
        delete: vi.fn(() => Promise.resolve({ data: { success: true } }))
    }
}));

describe('MigrationWorkspace', () => {
    let wrapper;
    let orgStore;
    let metadataStore;
    let mappingStore;

    beforeEach(() => {
        setActivePinia(createPinia());

        orgStore = useOrgStore();
        metadataStore = useMetadataStore();
        mappingStore = useMappingStore();

        // Mock loadProjects to prevent API calls
        vi.spyOn(orgStore, 'loadProjects').mockResolvedValue();
        vi.spyOn(mappingStore, 'loadMappings').mockResolvedValue();

        // Setup test data
        orgStore.projects = [
            { id: 'project-1', name: 'Test Project' }
        ];
        orgStore.orgs = [
            { id: 'org-1', name: 'Source Org', projectId: 'project-1' },
            { id: 'org-2', name: 'Target Org', projectId: 'project-1' }
        ];
        orgStore.selectedProject = orgStore.projects[0];
    });

    describe('Component Mounting', () => {
        it('should mount successfully', () => {
            wrapper = mount(MigrationWorkspace, {
                global: {
                    stubs: {
                        Card: true,
                        Select: true,
                        Button: true,
                        Message: true,
                        ProgressSpinner: true,
                        DataTable: true,
                        Column: true,
                        Badge: true
                    }
                }
            });

            expect(wrapper.exists()).toBe(true);
        });

        it('should display the workspace header', () => {
            wrapper = mount(MigrationWorkspace, {
                global: {
                    stubs: {
                        Card: true,
                        Select: true,
                        Button: true,
                        Message: true,
                        ProgressSpinner: true,
                        DataTable: true,
                        Column: true,
                        Badge: true
                    }
                }
            });

            expect(wrapper.find('.workspace-header').exists()).toBe(true);
            expect(wrapper.find('h1').text()).toBe('Migration Workspace');
        });

        it('should display project name when project is selected', () => {
            wrapper = mount(MigrationWorkspace, {
                global: {
                    stubs: {
                        Card: true,
                        Select: true,
                        Button: true,
                        Message: true,
                        ProgressSpinner: true,
                        DataTable: true,
                        Column: true,
                        Badge: true
                    }
                }
            });

            expect(wrapper.find('.project-name').text()).toContain('Test Project');
        });
    });

    describe('Org Selection', () => {
        beforeEach(() => {
            wrapper = mount(MigrationWorkspace, {
                global: {
                    stubs: {
                        Card: true,
                        Select: true,
                        Button: true,
                        Message: true,
                        ProgressSpinner: true,
                        DataTable: true,
                        Column: true,
                        Badge: true
                    }
                }
            });
        });

        it('should show available orgs for the project', () => {
            const vm = wrapper.vm;
            expect(vm.availableOrgs).toHaveLength(2);
            expect(vm.availableOrgs[0].name).toBe('Source Org');
            expect(vm.availableOrgs[1].name).toBe('Target Org');
        });

        it('should create org options for select dropdown', () => {
            const vm = wrapper.vm;
            expect(vm.sourceOrgOptions).toHaveLength(2);
            expect(vm.sourceOrgOptions[0].label).toBe('Source Org');
            expect(vm.targetOrgOptions[0].label).toBe('Source Org');
        });

        it('should update metadataStore when source org is selected', async () => {
            const vm = wrapper.vm;
            const sourceOrg = orgStore.orgs[0];

            vm.sourceOrgSelection = sourceOrg;
            await wrapper.vm.$nextTick();

            expect(metadataStore.sourceOrg).toEqual(sourceOrg);
        });

        it('should update metadataStore when target org is selected', async () => {
            const vm = wrapper.vm;
            const targetOrg = orgStore.orgs[1];

            vm.targetOrgSelection = targetOrg;
            await wrapper.vm.$nextTick();

            expect(metadataStore.targetOrg).toEqual(targetOrg);
        });
    });

    describe('Analyze Org Functionality', () => {
        beforeEach(() => {
            wrapper = mount(MigrationWorkspace, {
                global: {
                    stubs: {
                        Card: true,
                        Select: true,
                        Button: true,
                        Message: true,
                        ProgressSpinner: true,
                        DataTable: true,
                        Column: true,
                        Badge: true
                    }
                }
            });

            // Mock the store methods
            vi.spyOn(metadataStore, 'analyzeSourceOrg').mockResolvedValue();
            vi.spyOn(metadataStore, 'loadSourceObjects').mockResolvedValue();
            vi.spyOn(metadataStore, 'analyzeTargetOrg').mockResolvedValue();
            vi.spyOn(metadataStore, 'loadTargetObjects').mockResolvedValue();
        });

        it('should call analyzeSourceOrg when analyze button is clicked', async () => {
            const vm = wrapper.vm;
            metadataStore.setSourceOrg(orgStore.orgs[0]);

            await vm.analyzeSourceOrg();

            expect(metadataStore.analyzeSourceOrg).toHaveBeenCalledWith('org-1');
            expect(metadataStore.loadSourceObjects).toHaveBeenCalledWith('org-1');
        });

        it('should call analyzeTargetOrg when analyze button is clicked', async () => {
            const vm = wrapper.vm;
            metadataStore.setTargetOrg(orgStore.orgs[1]);

            await vm.analyzeTargetOrg();

            expect(metadataStore.analyzeTargetOrg).toHaveBeenCalledWith('org-2');
            expect(metadataStore.loadTargetObjects).toHaveBeenCalledWith('org-2');
        });

        it('should not analyze if no org is selected', async () => {
            const vm = wrapper.vm;

            await vm.analyzeSourceOrg();

            expect(metadataStore.analyzeSourceOrg).not.toHaveBeenCalled();
        });
    });

    describe('Object Lists', () => {
        beforeEach(() => {
            wrapper = mount(MigrationWorkspace, {
                global: {
                    stubs: {
                        Card: true,
                        Select: true,
                        Button: true,
                        Message: true,
                        ProgressSpinner: true,
                        DataTable: true,
                        Column: true,
                        Badge: true
                    }
                }
            });

            // Setup analyzed org data
            metadataStore.sourceObjects = [
                { id: 'obj-1', objectName: 'Account', objectLabel: 'Account', isCustom: false, recordCount: 100 },
                { id: 'obj-2', objectName: 'Contact', objectLabel: 'Contact', isCustom: false, recordCount: 200 }
            ];
            metadataStore.targetObjects = [
                { id: 'obj-3', objectName: 'Account', objectLabel: 'Account', isCustom: false, recordCount: 50 },
                { id: 'obj-4', objectName: 'CustomObject__c', objectLabel: 'Custom Object', isCustom: true, recordCount: 10 }
            ];
        });

        it('should show object list when source org is analyzed', () => {
            const vm = wrapper.vm;
            expect(vm.metadataStore.sourceAnalyzed).toBe(true);
        });

        it('should show object list when target org is analyzed', () => {
            const vm = wrapper.vm;
            expect(vm.metadataStore.targetAnalyzed).toBe(true);
        });

        it('should call selectSourceObject when an object is selected', () => {
            const vm = wrapper.vm;
            vi.spyOn(metadataStore, 'selectSourceObject');

            const object = metadataStore.sourceObjects[0];
            vm.selectSourceObject(object);

            expect(metadataStore.selectSourceObject).toHaveBeenCalledWith(object);
        });

        it('should call selectTargetObject when an object is selected', () => {
            const vm = wrapper.vm;
            vi.spyOn(metadataStore, 'selectTargetObject');

            const object = metadataStore.targetObjects[0];
            vm.selectTargetObject(object);

            expect(metadataStore.selectTargetObject).toHaveBeenCalledWith(object);
        });
    });

    describe('Mapping Panel', () => {
        beforeEach(() => {
            wrapper = mount(MigrationWorkspace, {
                global: {
                    stubs: {
                        Card: true,
                        Select: true,
                        Button: true,
                        Message: true,
                        ProgressSpinner: true,
                        DataTable: true,
                        Column: true,
                        Badge: true
                    }
                }
            });
        });

        it('should show empty state when orgs not ready', () => {
            const vm = wrapper.vm;
            expect(vm.metadataStore.readyForMapping).toBe(false);
        });

        it('should show mapping summary when orgs are ready', async () => {
            // Setup ready state
            metadataStore.sourceOrg = orgStore.orgs[0];
            metadataStore.targetOrg = orgStore.orgs[1];
            metadataStore.sourceObjects = [{ id: 'obj-1', objectName: 'Account' }];
            metadataStore.targetObjects = [{ id: 'obj-2', objectName: 'Account' }];

            await wrapper.vm.$nextTick();

            const vm = wrapper.vm;
            expect(vm.metadataStore.readyForMapping).toBe(true);
        });

        it('should display mapping statistics', () => {
            mappingStore.objectMappings = [
                { id: 'om-1', sourceObjectId: 'obj-1', targetObjectId: 'obj-2' }
            ];
            mappingStore.fieldMappings = [
                { id: 'fm-1', objectMappingId: 'om-1', sourceFieldId: 'f1', targetFieldId: 'f2' },
                { id: 'fm-2', objectMappingId: 'om-1', sourceFieldId: 'f3', targetFieldId: 'f4' }
            ];

            const vm = wrapper.vm;
            expect(vm.mappingSummary.objectMappings).toBe(1);
            expect(vm.mappingSummary.fieldMappings).toBe(2);
        });
    });

    describe('Loading States', () => {
        beforeEach(() => {
            wrapper = mount(MigrationWorkspace, {
                global: {
                    stubs: {
                        Card: true,
                        Select: true,
                        Button: true,
                        Message: true,
                        ProgressSpinner: true,
                        DataTable: true,
                        Column: true,
                        Badge: true
                    }
                }
            });
        });

        it('should disable analyze button when loading', () => {
            metadataStore.setSourceOrg(orgStore.orgs[0]);
            metadataStore.loadingSourceObjects = true;

            const vm = wrapper.vm;
            expect(vm.canAnalyze.source).toBe(false);
        });

        it('should show loading state when analyzing', () => {
            metadataStore.loadingSourceObjects = true;
            const vm = wrapper.vm;
            expect(vm.metadataStore.loadingSourceObjects).toBe(true);
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            wrapper = mount(MigrationWorkspace, {
                global: {
                    stubs: {
                        Card: true,
                        Select: true,
                        Button: true,
                        Message: true,
                        ProgressSpinner: true,
                        DataTable: true,
                        Column: true,
                        Badge: true
                    }
                }
            });
        });

        it('should display error message when source analysis fails', () => {
            metadataStore.sourceError = 'Failed to analyze org';
            const vm = wrapper.vm;
            expect(vm.metadataStore.sourceError).toBe('Failed to analyze org');
        });

        it('should display error message when target analysis fails', () => {
            metadataStore.targetError = 'Connection failed';
            const vm = wrapper.vm;
            expect(vm.metadataStore.targetError).toBe('Connection failed');
        });
    });
});
