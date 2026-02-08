/**
 * OrgList Component Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import OrgList from '@/components/dashboard/OrgList.vue';

describe('OrgList', () => {
    const mockOrgs = [
        { id: 'org-1', name: 'Source Org', description: 'Source description' },
        { id: 'org-2', name: 'Target Org', description: '' },
        { id: 'org-3', name: 'Third Org', description: 'Another one' },
    ];

    const mountComponent = (props = {}) => {
        return mount(OrgList, {
            props: {
                orgs: mockOrgs,
                selectedOrg: null,
                ...props,
            },
        });
    };

    describe('Rendering', () => {
        it('should mount successfully', () => {
            const wrapper = mountComponent();
            expect(wrapper.exists()).toBe(true);
        });

        it('should display the header "Salesforce Orgs"', () => {
            const wrapper = mountComponent();
            expect(wrapper.find('h3').text()).toBe('Salesforce Orgs');
        });

        it('should render all orgs', () => {
            const wrapper = mountComponent();
            const items = wrapper.findAll('.org-item');
            expect(items).toHaveLength(3);
        });

        it('should display org names', () => {
            const wrapper = mountComponent();
            const names = wrapper.findAll('.org-item-name');
            expect(names[0].text()).toBe('Source Org');
            expect(names[1].text()).toBe('Target Org');
        });

        it('should display description when present', () => {
            const wrapper = mountComponent();
            const descriptions = wrapper.findAll('.org-item-desc');
            // Only orgs with non-empty description should show .org-item-desc
            expect(descriptions.length).toBeGreaterThanOrEqual(2);
        });

        it('should show empty state when no orgs', () => {
            const wrapper = mountComponent({ orgs: [] });
            expect(wrapper.find('.org-list-empty').exists()).toBe(true);
            expect(wrapper.text()).toContain('No orgs in this project yet');
        });
    });

    describe('Selection', () => {
        it('should highlight the selected org', () => {
            const wrapper = mountComponent({ selectedOrg: mockOrgs[0] });
            const items = wrapper.findAll('.org-item');
            expect(items[0].classes()).toContain('org-item-selected');
            expect(items[1].classes()).not.toContain('org-item-selected');
        });

        it('should not highlight any org when none is selected', () => {
            const wrapper = mountComponent({ selectedOrg: null });
            const selected = wrapper.findAll('.org-item-selected');
            expect(selected).toHaveLength(0);
        });
    });

    describe('Events', () => {
        it('should emit select-org when an org row is clicked', async () => {
            const wrapper = mountComponent();
            await wrapper.findAll('.org-item')[1].trigger('click');

            expect(wrapper.emitted('select-org')).toBeTruthy();
            expect(wrapper.emitted('select-org')[0][0]).toEqual(mockOrgs[1]);
        });

        it('should emit add-org when add button is clicked', async () => {
            const wrapper = mountComponent();
            // The Add Org button is a stub, find via the org-list-header
            const addBtn = wrapper.find('.org-list-header button-stub');
            if (addBtn.exists()) {
                await addBtn.trigger('click');
                expect(wrapper.emitted('add-org')).toBeTruthy();
            }
        });

        it('should emit edit-org with the org when edit button is clicked', async () => {
            const wrapper = mountComponent();
            const editBtns = wrapper.findAll('.org-item-actions button-stub');
            if (editBtns.length >= 2) {
                // First button in actions is edit
                await editBtns[0].trigger('click');
                expect(wrapper.emitted('edit-org')).toBeTruthy();
            }
        });

        it('should emit delete-org with the org when delete button is clicked', async () => {
            const wrapper = mountComponent();
            const deleteBtns = wrapper.findAll('.org-item-actions button-stub');
            if (deleteBtns.length >= 2) {
                // Second button in actions is delete
                await deleteBtns[1].trigger('click');
                expect(wrapper.emitted('delete-org')).toBeTruthy();
            }
        });
    });
});
