/**
 * ObjectList Component Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ObjectList from '@/components/dashboard/ObjectList.vue';

describe('ObjectList', () => {
    const mockObjects = [
        { id: 'obj-1', objectName: 'Account', objectLabel: 'Account', isCustom: false },
        { id: 'obj-2', objectName: 'MyCustom__c', objectLabel: 'My Custom', isCustom: true },
        { id: 'obj-3', objectName: 'Contact', objectLabel: 'Contact', isCustom: false },
        { id: 'obj-4', objectName: 'Widget__c', objectLabel: 'Widget', isCustom: true },
    ];

    const mountComponent = (props = {}) => {
        return mount(ObjectList, {
            props: {
                objects: mockObjects,
                selectedObject: null,
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

        it('should display default title "Objects"', () => {
            const wrapper = mountComponent();
            expect(wrapper.find('h3').text()).toBe('Objects');
        });

        it('should display custom title', () => {
            const wrapper = mountComponent({ title: 'Source Objects' });
            expect(wrapper.find('h3').text()).toBe('Source Objects');
        });

        it('should render all objects', () => {
            const wrapper = mountComponent();
            const items = wrapper.findAll('.object-item');
            expect(items).toHaveLength(4);
        });

        it('should display object labels and API names', () => {
            const wrapper = mountComponent();
            const labels = wrapper.findAll('.object-item-label');
            const apis = wrapper.findAll('.object-item-api');

            expect(labels[0].text()).toBe('Account');
            expect(apis[0].text()).toBe('(Account)');
            expect(labels[1].text()).toBe('My Custom');
            expect(apis[1].text()).toBe('(MyCustom__c)');
        });

        it('should show object count', () => {
            const wrapper = mountComponent();
            expect(wrapper.find('.object-count').text()).toBe('4 objects');
        });

        it('should show empty state when no objects match', () => {
            const wrapper = mountComponent({ objects: [] });
            expect(wrapper.find('.object-list-empty').exists()).toBe(true);
        });

        it('should show loading state', () => {
            const wrapper = mountComponent({ loading: true });
            expect(wrapper.find('.object-list-loading').exists()).toBe(true);
        });
    });

    describe('Search / Filtering', () => {
        it('should filter objects by search query (label)', async () => {
            const wrapper = mountComponent();
            wrapper.vm.searchQuery = 'account';

            await wrapper.vm.$nextTick();
            const items = wrapper.findAll('.object-item');
            expect(items).toHaveLength(1);
            expect(items[0].find('.object-item-label').text()).toBe('Account');
        });

        it('should filter objects by search query (API name)', async () => {
            const wrapper = mountComponent();
            wrapper.vm.searchQuery = 'Widget__c';

            await wrapper.vm.$nextTick();
            const items = wrapper.findAll('.object-item');
            expect(items).toHaveLength(1);
        });

        it('should show custom only when toggled', async () => {
            const wrapper = mountComponent();
            wrapper.vm.showCustomOnly = true;

            await wrapper.vm.$nextTick();
            const items = wrapper.findAll('.object-item');
            expect(items).toHaveLength(2);
        });

        it('should combine search and custom filter', async () => {
            const wrapper = mountComponent();
            wrapper.vm.showCustomOnly = true;
            wrapper.vm.searchQuery = 'widget';

            await wrapper.vm.$nextTick();
            const items = wrapper.findAll('.object-item');
            expect(items).toHaveLength(1);
        });

        it('should update count text when filtered', async () => {
            const wrapper = mountComponent();
            wrapper.vm.searchQuery = 'account';

            await wrapper.vm.$nextTick();
            expect(wrapper.find('.object-count').text()).toBe('1 of 4 objects');
        });
    });

    describe('Selection', () => {
        it('should highlight the selected object', () => {
            const wrapper = mountComponent({ selectedObject: mockObjects[2] });
            const items = wrapper.findAll('.object-item');
            expect(items[2].classes()).toContain('object-item-selected');
        });

        it('should emit select-object when clicked', async () => {
            const wrapper = mountComponent();
            await wrapper.findAll('.object-item')[1].trigger('click');

            expect(wrapper.emitted('select-object')).toBeTruthy();
            expect(wrapper.emitted('select-object')[0][0]).toEqual(mockObjects[1]);
        });
    });

    describe('Computed - objectCount', () => {
        it('should show total count when not filtered', () => {
            const wrapper = mountComponent();
            expect(wrapper.vm.objectCount).toBe('4 objects');
        });

        it('should show filtered count', () => {
            const wrapper = mountComponent();
            wrapper.vm.searchQuery = 'contact';
            expect(wrapper.vm.objectCount).toBe('1 of 4 objects');
        });
    });
});
