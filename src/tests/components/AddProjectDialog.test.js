/**
 * AddProjectDialog Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AddProjectDialog from '@/components/AddProjectDialog.vue';
import { useOrgStore } from '@/stores/orgStore';
import axiosInstance from '@/api/axiosInstance';

vi.mock('@/api/axiosInstance');

describe('AddProjectDialog', () => {
    let orgStore;

    beforeEach(() => {
        setActivePinia(createPinia());
        orgStore = useOrgStore();
        vi.clearAllMocks();
    });

    const mountComponent = () => {
        return mount(AddProjectDialog, {
            global: {
                stubs: {
                    Dialog: {
                        template: '<div class="dialog-stub"><slot /><slot name="footer" /></div>',
                        props: ['visible', 'header'],
                    },
                    InputText: true,
                    Button: true,
                },
            },
        });
    };

    describe('Rendering', () => {
        it('should mount successfully', () => {
            const wrapper = mountComponent();
            expect(wrapper.exists()).toBe(true);
        });
    });

    describe('Visibility', () => {
        it('should bind visibility to orgStore.showAddProjectDialog', () => {
            orgStore.showAddProjectDialog = true;
            const wrapper = mountComponent();

            // The computed visible getter reads from the store
            expect(wrapper.vm.visible).toBe(true);
        });

        it('should set store flag false on close', () => {
            orgStore.showAddProjectDialog = true;
            const wrapper = mountComponent();

            wrapper.vm.onClose();
            expect(orgStore.showAddProjectDialog).toBe(false);
        });
    });

    describe('Save', () => {
        it('should call PUT with add-project action on save', async () => {
            axiosInstance.put.mockResolvedValueOnce({ status: 201 });
            // Mock loadProjects
            axiosInstance.get
                .mockResolvedValueOnce({ data: { success: true, data: [] } })
                .mockResolvedValueOnce({ data: { success: true, data: [] } });

            orgStore.showAddProjectDialog = true;
            const wrapper = mountComponent();
            wrapper.vm.form.name = 'New Project';
            wrapper.vm.form.description = 'A test project';

            await wrapper.vm.onSave();

            expect(axiosInstance.put).toHaveBeenCalledWith(
                '/',
                { name: 'New Project', description: 'A test project' },
                expect.objectContaining({
                    headers: { action: 'add-project' },
                })
            );
        });

        it('should close dialog after successful save', async () => {
            axiosInstance.put.mockResolvedValueOnce({ status: 201 });
            axiosInstance.get
                .mockResolvedValueOnce({ data: { success: true, data: [] } })
                .mockResolvedValueOnce({ data: { success: true, data: [] } });

            orgStore.showAddProjectDialog = true;
            const wrapper = mountComponent();
            wrapper.vm.form.name = 'Test';

            await wrapper.vm.onSave();

            expect(orgStore.showAddProjectDialog).toBe(false);
        });

        it('should handle save error gracefully', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            axiosInstance.put.mockRejectedValueOnce(new Error('Network error'));

            const wrapper = mountComponent();
            wrapper.vm.form.name = 'Test';

            await wrapper.vm.onSave();

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});
