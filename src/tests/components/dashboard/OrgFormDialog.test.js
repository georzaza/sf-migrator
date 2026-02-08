/**
 * OrgFormDialog Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrgFormDialog from '@/components/dashboard/OrgFormDialog.vue';
import axiosInstance from '@/api/axiosInstance';

vi.mock('@/api/axiosInstance');

describe('OrgFormDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mountComponent = (props = {}) => {
        return mount(OrgFormDialog, {
            props: {
                visible: true,
                org: null,
                projectId: 'project-1',
                ...props,
            },
        });
    };

    describe('Rendering', () => {
        it('should mount successfully', () => {
            const wrapper = mountComponent();
            expect(wrapper.exists()).toBe(true);
        });

        it('should show "Add New Org" header in add mode', () => {
            const wrapper = mountComponent({ org: null });
            // The Dialog component is stubbed, but the dialogHeader computed should be set
            expect(wrapper.vm.dialogHeader).toBe('Add New Org');
        });

        it('should show "Edit Org" header in edit mode', () => {
            const wrapper = mountComponent({
                org: { id: 'org-1', name: 'Test', loginURL: 'https://test.salesforce.com' },
            });
            expect(wrapper.vm.dialogHeader).toBe('Edit Org');
        });

        it('should detect edit mode from org prop', () => {
            const wrapper = mountComponent({
                org: { id: 'org-1', name: 'My Org' },
            });
            expect(wrapper.vm.isEditMode).toBe(true);
        });

        it('should detect add mode when org is null', () => {
            const wrapper = mountComponent({ org: null });
            expect(wrapper.vm.isEditMode).toBe(false);
        });
    });

    describe('Form initialization', () => {
        it('should initialize with empty form in add mode', () => {
            const wrapper = mountComponent({ org: null });
            expect(wrapper.vm.form.name).toBe('');
            expect(wrapper.vm.form.connectionType).toBe('Credentials');
        });

        it('should populate form from org in edit mode', async () => {
            const org = {
                id: 'org-1',
                name: 'My Org',
                description: 'A description',
                loginURL: 'https://test.salesforce.com',
                connectionType: 'OAuth',
            };
            // Mount with visible:false first, then toggle to true so the watcher fires
            const wrapper = mountComponent({ org, visible: false });
            await wrapper.setProps({ visible: true });
            await wrapper.vm.$nextTick();

            // Form should be filled from org (credentials left blank)
            expect(wrapper.vm.form.name).toBe('My Org');
            expect(wrapper.vm.form.description).toBe('A description');
            expect(wrapper.vm.form.loginURL).toBe('https://test.salesforce.com');
            expect(wrapper.vm.form.connectionType).toBe('OAuth');
            expect(wrapper.vm.form.username).toBe('');
            expect(wrapper.vm.form.password).toBe('');
        });
    });

    describe('Save - Add mode', () => {
        it('should call PUT with add-org action for new org', async () => {
            axiosInstance.put.mockResolvedValueOnce({
                status: 201,
                data: { success: true },
            });

            const wrapper = mountComponent({ org: null, projectId: 'p-1' });
            wrapper.vm.form.name = 'New Org';
            wrapper.vm.form.loginURL = 'https://test.salesforce.com';
            wrapper.vm.form.username = 'user@test.com';
            wrapper.vm.form.password = 'pass';
            wrapper.vm.form.securityToken = 'token';

            await wrapper.vm.onSave();

            expect(axiosInstance.put).toHaveBeenCalledWith(
                '/',
                expect.objectContaining({
                    name: 'New Org',
                    projectId: 'p-1',
                }),
                { headers: { action: 'add-org' } }
            );
            expect(wrapper.emitted('saved')).toBeTruthy();
        });

        it('should show error on 400 response', async () => {
            axiosInstance.put.mockResolvedValueOnce({
                status: 400,
                data: { message: 'Name is required' },
            });

            const wrapper = mountComponent({ org: null });
            await wrapper.vm.onSave();

            expect(wrapper.vm.errorMessage).toBe('Name is required');
        });
    });

    describe('Save - Edit mode', () => {
        it('should call PUT with update-org action for existing org', async () => {
            const org = { id: 'org-1', name: 'Existing' };
            axiosInstance.put.mockResolvedValueOnce({
                data: { success: true },
            });

            const wrapper = mountComponent({ org });
            wrapper.vm.form.name = 'Updated Name';

            await wrapper.vm.onSave();

            expect(axiosInstance.put).toHaveBeenCalledWith(
                '/',
                expect.objectContaining({ name: 'Updated Name' }),
                { headers: { action: 'update-org', orgid: 'org-1' } }
            );
            expect(wrapper.emitted('saved')).toBeTruthy();
        });

        it('should strip empty credential fields in edit mode', async () => {
            const org = { id: 'org-1', name: 'Test' };
            axiosInstance.put.mockResolvedValueOnce({ data: { success: true } });

            const wrapper = mountComponent({ org });
            wrapper.vm.form.name = 'Test';
            wrapper.vm.form.username = '';
            wrapper.vm.form.password = '';
            wrapper.vm.form.securityToken = '';

            await wrapper.vm.onSave();

            const payload = axiosInstance.put.mock.calls[0][1];
            expect(payload).not.toHaveProperty('username');
            expect(payload).not.toHaveProperty('password');
            expect(payload).not.toHaveProperty('securityToken');
        });

        it('should show error message on failed update', async () => {
            const org = { id: 'org-1', name: 'Test' };
            axiosInstance.put.mockResolvedValueOnce({
                data: { success: false, message: 'Update failed' },
            });

            const wrapper = mountComponent({ org });
            await wrapper.vm.onSave();

            expect(wrapper.vm.errorMessage).toBe('Update failed');
        });
    });

    describe('Close', () => {
        it('should emit update:visible false on close', () => {
            const wrapper = mountComponent();
            wrapper.vm.onClose();

            expect(wrapper.emitted('update:visible')).toBeTruthy();
            expect(wrapper.emitted('update:visible')[0][0]).toBe(false);
        });
    });

    describe('Error handling', () => {
        it('should set errorMessage on axios error', async () => {
            axiosInstance.put.mockRejectedValueOnce({
                response: { data: { message: 'Server error' } },
            });

            const wrapper = mountComponent({ org: null });
            await wrapper.vm.onSave();

            expect(wrapper.vm.errorMessage).toBe('Server error');
        });
    });
});
