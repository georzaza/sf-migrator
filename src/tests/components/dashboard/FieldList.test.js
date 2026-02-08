/**
 * FieldList Component Tests
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FieldList from '@/components/dashboard/FieldList.vue';

describe('FieldList', () => {
    const mockFields = [
        { id: 'f-1', fieldName: 'Name', fieldLabel: 'Full Name' },
        { id: 'f-2', fieldName: 'Email', fieldLabel: 'Email Address' },
        { id: 'f-3', fieldName: 'Phone', fieldLabel: 'Phone Number' },
        { id: 'f-4', fieldName: 'Custom__c', fieldLabel: 'Custom Field' },
    ];

    const mountComponent = (props = {}) => {
        return mount(FieldList, {
            props: {
                fields: mockFields,
                loading: false,
                ...props,
            },
        });
    };

    describe('Rendering', () => {
        it('should mount successfully', () => {
            const wrapper = mountComponent();
            expect(wrapper.exists()).toBe(true);
        });

        it('should display "Fields" header', () => {
            const wrapper = mountComponent();
            expect(wrapper.find('h4').text()).toBe('Fields');
        });

        it('should render all fields', () => {
            const wrapper = mountComponent();
            const items = wrapper.findAll('.field-item');
            expect(items).toHaveLength(4);
        });

        it('should display field labels and API names', () => {
            const wrapper = mountComponent();
            const labels = wrapper.findAll('.field-label');
            const apis = wrapper.findAll('.field-api');

            expect(labels[0].text()).toBe('Full Name');
            expect(apis[0].text()).toBe('(Name)');
        });

        it('should show field count', () => {
            const wrapper = mountComponent();
            expect(wrapper.find('.field-count').text()).toBe('4 fields');
        });

        it('should show empty state when no fields', () => {
            const wrapper = mountComponent({ fields: [] });
            expect(wrapper.find('.field-list-empty').exists()).toBe(true);
            expect(wrapper.text()).toContain('No fields available');
        });

        it('should show loading state', () => {
            const wrapper = mountComponent({ loading: true });
            expect(wrapper.find('.field-list-loading').exists()).toBe(true);
        });
    });

    describe('Search', () => {
        it('should filter fields by label', async () => {
            const wrapper = mountComponent();
            wrapper.vm.searchQuery = 'email';

            await wrapper.vm.$nextTick();
            const items = wrapper.findAll('.field-item');
            expect(items).toHaveLength(1);
            expect(items[0].find('.field-label').text()).toBe('Email Address');
        });

        it('should filter fields by API name', async () => {
            const wrapper = mountComponent();
            wrapper.vm.searchQuery = 'custom__c';

            await wrapper.vm.$nextTick();
            const items = wrapper.findAll('.field-item');
            expect(items).toHaveLength(1);
        });

        it('should show "no fields match" when search returns nothing', async () => {
            const wrapper = mountComponent();
            wrapper.vm.searchQuery = 'nonexistent';

            await wrapper.vm.$nextTick();
            expect(wrapper.text()).toContain('No fields match your search');
        });

        it('should update count when filtered', async () => {
            const wrapper = mountComponent();
            wrapper.vm.searchQuery = 'phone';

            await wrapper.vm.$nextTick();
            expect(wrapper.find('.field-count').text()).toBe('1 of 4 fields');
        });

        it('should show all fields when search is empty', async () => {
            const wrapper = mountComponent();
            wrapper.vm.searchQuery = 'email';
            await wrapper.vm.$nextTick();
            expect(wrapper.findAll('.field-item')).toHaveLength(1);

            wrapper.vm.searchQuery = '';
            await wrapper.vm.$nextTick();
            expect(wrapper.findAll('.field-item')).toHaveLength(4);
        });
    });

    describe('Computed - fieldCount', () => {
        it('should show total count when not filtering', () => {
            const wrapper = mountComponent();
            expect(wrapper.vm.fieldCount).toBe('4 fields');
        });

        it('should show filtered/total when searching', () => {
            const wrapper = mountComponent();
            wrapper.vm.searchQuery = 'name';
            expect(wrapper.vm.fieldCount).toBe('1 of 4 fields');
        });
    });
});
