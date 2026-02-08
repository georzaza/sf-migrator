/**
 * Dashboard View Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Dashboard from '@/views/Dashboard.vue';
import { useOrgStore } from '@/stores/orgStore';
import axiosInstance from '@/api/axiosInstance';

vi.mock('@/api/axiosInstance');

// Mock child components
vi.mock('@/components/dashboard/OrgList.vue', () => ({
    default: {
        name: 'OrgList',
        template: '<div class="org-list-stub"></div>',
        props: ['orgs', 'selectedOrg'],
    },
}));

vi.mock('@/components/dashboard/OrgFormDialog.vue', () => ({
    default: {
        name: 'OrgFormDialog',
        template: '<div class="org-form-dialog-stub"></div>',
        props: ['visible', 'org', 'projectId'],
    },
}));

vi.mock('@/components/dashboard/ObjectList.vue', () => ({
    default: {
        name: 'ObjectList',
        template: '<div class="object-list-stub"></div>',
        props: ['objects', 'selectedObject', 'loading'],
    },
}));

vi.mock('@/components/dashboard/ObjectDetail.vue', () => ({
    default: {
        name: 'ObjectDetail',
        template: '<div class="object-detail-stub"></div>',
        props: ['object', 'fields', 'loadingFields'],
    },
}));

vi.mock('@/components/AddProjectDialog.vue', () => ({
    default: {
        name: 'AddProjectDialog',
        template: '<div class="add-project-dialog-stub"></div>',
    },
}));

describe('Dashboard', () => {
    let orgStore;

    beforeEach(() => {
        setActivePinia(createPinia());
        orgStore = useOrgStore();
        vi.clearAllMocks();

        // Prevent loadProjects from making real calls during mount
        axiosInstance.get.mockResolvedValue({ data: { success: true, data: [] } });
    });

    const mountComponent = () => {
        return mount(Dashboard, {
            global: {
                stubs: {
                    Select: true,
                    Button: true,
                    ProgressSpinner: true,
                    AddProjectDialog: true,
                },
            },
        });
    };

    describe('Mounting', () => {
        it('should mount successfully', () => {
            const wrapper = mountComponent();
            expect(wrapper.exists()).toBe(true);
        });

        it('should call loadProjects on mount', () => {
            mountComponent();
            // loadProjects calls get-projects, which we mocked
            expect(axiosInstance.get).toHaveBeenCalled();
        });
    });

    describe('Project Selection', () => {
        it('should show empty state when no project is selected', () => {
            orgStore.selectedProject = null;
            const wrapper = mountComponent();

            expect(wrapper.find('.dashboard-empty').exists()).toBe(true);
            expect(wrapper.text()).toContain('Select a project to get started');
        });

        it('should show dashboard content when project is selected', () => {
            orgStore.selectedProject = { id: 'p-1', name: 'Test Project' };
            const wrapper = mountComponent();

            expect(wrapper.find('.dashboard-content').exists()).toBe(true);
            expect(wrapper.find('.dashboard-empty').exists()).toBe(false);
        });

        it('should set showAddProjectDialog when Create Project clicked', () => {
            const wrapper = mountComponent();
            wrapper.vm.onCreateProject();

            expect(orgStore.showAddProjectDialog).toBe(true);
        });

        it('should delegate project change to orgStore', () => {
            const spy = vi.spyOn(orgStore, 'setSelectedProject');
            const wrapper = mountComponent();
            const project = { id: 'p-1', name: 'Test' };

            wrapper.vm.onProjectChange(project);

            expect(spy).toHaveBeenCalledWith(project);
        });
    });

    describe('Org Detail - No Org Selected', () => {
        it('should show placeholder when no org selected', () => {
            orgStore.selectedProject = { id: 'p-1', name: 'Test' };
            orgStore.selectedOrg = null;
            const wrapper = mountComponent();

            expect(wrapper.find('.detail-placeholder').exists()).toBe(true);
            expect(wrapper.text()).toContain('Select an org to view its details');
        });
    });

    describe('Org Detail - Org Selected', () => {
        it('should display org name when selected', async () => {
            orgStore.selectedProject = { id: 'p-1', name: 'Test' };
            orgStore.selectedOrg = { id: 'org-1', name: 'My Org', description: 'Desc' };

            // Mock the analysis check triggered by watcher
            axiosInstance.get.mockResolvedValue({
                data: { success: true, data: [] },
            });

            const wrapper = mountComponent();
            await wrapper.vm.$nextTick();
            await wrapper.vm.$nextTick();

            expect(wrapper.find('.detail-header h2').text()).toBe('My Org');
            expect(wrapper.find('.detail-desc').text()).toBe('Desc');
        });
    });

    describe('Org Actions', () => {
        it('onSelectOrg should set selectedOrg in store', () => {
            const spy = vi.spyOn(orgStore, 'setSelectedOrg');
            const wrapper = mountComponent();
            const org = { id: 'org-1', name: 'Test' };

            wrapper.vm.onSelectOrg(org);

            expect(spy).toHaveBeenCalledWith(org);
        });

        it('onAddOrg should open form dialog in add mode', () => {
            const wrapper = mountComponent();
            wrapper.vm.onAddOrg();

            expect(wrapper.vm.orgFormOrg).toBeNull();
            expect(wrapper.vm.orgFormVisible).toBe(true);
        });

        it('onEditOrg should open form dialog in edit mode', () => {
            const org = { id: 'org-1', name: 'Editing' };
            const wrapper = mountComponent();
            wrapper.vm.onEditOrg(org);

            expect(wrapper.vm.orgFormOrg).toEqual(org);
            expect(wrapper.vm.orgFormVisible).toBe(true);
        });
    });

    describe('Analysis Check', () => {
        it('checkOrgAnalysis should set hasAnalysis true when objects exist', async () => {
            const mockObjects = [
                { id: 'obj-1', objectName: 'Account' },
                { id: 'obj-2', objectName: 'Contact' },
            ];

            axiosInstance.get.mockResolvedValue({
                data: { success: true, data: mockObjects },
            });

            const wrapper = mountComponent();
            await wrapper.vm.checkOrgAnalysis('org-1');

            expect(wrapper.vm.hasAnalysis).toBe(true);
            expect(wrapper.vm.objects).toEqual(mockObjects);
        });

        it('checkOrgAnalysis should set hasAnalysis false when no objects', async () => {
            axiosInstance.get.mockResolvedValue({
                data: { success: true, data: [] },
            });

            const wrapper = mountComponent();
            await wrapper.vm.checkOrgAnalysis('org-1');

            expect(wrapper.vm.hasAnalysis).toBe(false);
            expect(wrapper.vm.objects).toEqual([]);
        });

        it('checkOrgAnalysis should handle API errors gracefully', async () => {
            // First call for loadProjects succeeds, subsequent calls for checkOrgAnalysis fail
            axiosInstance.get
                .mockResolvedValueOnce({ data: { success: true, data: [] } }) // loadProjects
                .mockResolvedValueOnce({ data: { success: true, data: [] } }) // loadOrgs
                .mockRejectedValueOnce(new Error('Network')); // checkOrgAnalysis

            const wrapper = mountComponent();
            await wrapper.vm.$nextTick(); // wait for mount
            await wrapper.vm.checkOrgAnalysis('org-1');

            expect(wrapper.vm.hasAnalysis).toBe(false);
        });

        it('should call get-objects with correct headers', async () => {
            axiosInstance.get.mockResolvedValue({
                data: { success: true, data: [] },
            });

            const wrapper = mountComponent();
            await wrapper.vm.checkOrgAnalysis('org-99');

            expect(axiosInstance.get).toHaveBeenCalledWith('/', {
                headers: { action: 'get-objects', orgid: 'org-99' },
            });
        });
    });

    describe('Object / Field Loading', () => {
        it('onSelectObject should set selectedObject and clear fields', () => {
            const wrapper = mountComponent();
            wrapper.vm.fields = [{ id: 'f-1' }];
            const obj = { id: 'obj-1', objectName: 'Account' };

            wrapper.vm.onSelectObject(obj);

            expect(wrapper.vm.selectedObject).toEqual(obj);
            expect(wrapper.vm.fields).toEqual([]);
        });

        it('onLoadFields should fetch fields from API', async () => {
            const mockFields = [
                { id: 'f-1', fieldName: 'Name' },
                { id: 'f-2', fieldName: 'Email' },
            ];

            axiosInstance.get.mockResolvedValue({
                data: { success: true, data: mockFields },
            });

            const wrapper = mountComponent();
            await wrapper.vm.onLoadFields({ id: 'obj-1' });

            expect(wrapper.vm.fields).toEqual(mockFields);
            expect(wrapper.vm.loadingFields).toBe(false);
        });

        it('onLoadFields should call get-fields with correct headers', async () => {
            axiosInstance.get.mockResolvedValue({
                data: { success: true, data: [] },
            });

            const wrapper = mountComponent();
            await wrapper.vm.onLoadFields({ id: 'obj-42' });

            expect(axiosInstance.get).toHaveBeenCalledWith('/', {
                headers: { action: 'get-fields', objectid: 'obj-42' },
            });
        });

        it('onLoadFields should set loadingFields during fetch', async () => {
            let resolvePromise;
            axiosInstance.get.mockReturnValueOnce(
                new Promise(resolve => { resolvePromise = resolve; })
            );

            const wrapper = mountComponent();
            const promise = wrapper.vm.onLoadFields({ id: 'obj-1' });

            expect(wrapper.vm.loadingFields).toBe(true);

            resolvePromise({ data: { success: true, data: [] } });
            await promise;

            expect(wrapper.vm.loadingFields).toBe(false);
        });
    });

    describe('Delete Org', () => {
        it('should call orgStore.deleteOrg after confirmation', async () => {
            const originalConfirm = window.confirm;
            window.confirm = vi.fn(() => true);
            vi.spyOn(orgStore, 'deleteOrg').mockResolvedValue(true);

            const wrapper = mountComponent();
            await wrapper.vm.onDeleteOrg({ id: 'org-1', name: 'Test Org' });

            expect(orgStore.deleteOrg).toHaveBeenCalledWith('org-1');
            window.confirm = originalConfirm;
        });

        it('should not delete when confirmation is cancelled', async () => {
            const originalConfirm = window.confirm;
            window.confirm = vi.fn(() => false);
            vi.spyOn(orgStore, 'deleteOrg');

            const wrapper = mountComponent();
            await wrapper.vm.onDeleteOrg({ id: 'org-1', name: 'Test Org' });

            expect(orgStore.deleteOrg).not.toHaveBeenCalled();
            window.confirm = originalConfirm;
        });
    });
});
