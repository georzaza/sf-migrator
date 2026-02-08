/**
 * ObjectDetail Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ObjectDetail from '@/components/dashboard/ObjectDetail.vue';

// We need to also stub FieldList since ObjectDetail imports it directly
vi.mock('@/components/dashboard/FieldList.vue', () => ({
    default: {
        name: 'FieldList',
        template: '<div class="field-list-stub"></div>',
        props: ['fields', 'loading'],
    },
}));

describe('ObjectDetail', () => {
    const mockObject = {
        id: 'obj-1',
        objectName: 'Account',
        objectLabel: 'Account',
        isCustom: false,
        recordCount: 15230,
    };

    const mockCustomObject = {
        id: 'obj-2',
        objectName: 'Widget__c',
        objectLabel: 'Widget',
        isCustom: true,
        recordCount: 42,
    };

    const mockFields = [
        { id: 'f-1', fieldName: 'Name', fieldLabel: 'Name' },
        { id: 'f-2', fieldName: 'Email', fieldLabel: 'Email' },
    ];

    const mountComponent = (props = {}) => {
        return mount(ObjectDetail, {
            props: {
                object: mockObject,
                fields: [],
                loadingFields: false,
                ...props,
            },
        });
    };

    describe('Rendering', () => {
        it('should mount successfully', () => {
            const wrapper = mountComponent();
            expect(wrapper.exists()).toBe(true);
        });

        it('should display object label', () => {
            const wrapper = mountComponent();
            expect(wrapper.find('h3').text()).toBe('Account');
        });

        it('should display API name', () => {
            const wrapper = mountComponent();
            expect(wrapper.text()).toContain('Account');
        });

        it('should display record count', () => {
            const wrapper = mountComponent();
            expect(wrapper.text()).toContain('15,230');
        });

        it('should render nothing when object is null', () => {
            const wrapper = mountComponent({ object: null });
            expect(wrapper.find('.object-detail').exists()).toBe(false);
        });

        it('should show Standard tag for non-custom objects', () => {
            const wrapper = mountComponent({ object: mockObject });
            // Tag is stubbed, but we can check the component's template rendering
            const tags = wrapper.findAll('tag-stub');
            // One tag should have value="Standard"
            const standardTag = tags.find(t => t.attributes('value') === 'Standard');
            expect(standardTag).toBeTruthy();
        });

        it('should show Custom tag for custom objects', () => {
            const wrapper = mountComponent({ object: mockCustomObject });
            const tags = wrapper.findAll('tag-stub');
            const customTag = tags.find(t => t.attributes('value') === 'Custom');
            expect(customTag).toBeTruthy();
        });
    });

    describe('Field Toggle', () => {
        it('should not show fields initially', () => {
            const wrapper = mountComponent();
            expect(wrapper.vm.showFields).toBe(false);
            expect(wrapper.find('.object-detail-fields').exists()).toBe(false);
        });

        it('should toggle fields and emit load-fields on first open', async () => {
            const wrapper = mountComponent({ fields: [] });
            wrapper.vm.onToggleFields();

            expect(wrapper.vm.showFields).toBe(true);
            expect(wrapper.emitted('load-fields')).toBeTruthy();
            expect(wrapper.emitted('load-fields')[0][0]).toEqual(mockObject);
        });

        it('should not emit load-fields if fields already loaded', () => {
            const wrapper = mountComponent({ fields: mockFields });
            wrapper.vm.onToggleFields();

            expect(wrapper.vm.showFields).toBe(true);
            expect(wrapper.emitted('load-fields')).toBeFalsy();
        });

        it('should hide fields on second toggle', () => {
            const wrapper = mountComponent({ fields: mockFields });
            wrapper.vm.onToggleFields(); // open
            wrapper.vm.onToggleFields(); // close

            expect(wrapper.vm.showFields).toBe(false);
        });

        it('should reset showFields when object changes', async () => {
            const wrapper = mountComponent({ fields: mockFields });
            wrapper.vm.onToggleFields();
            expect(wrapper.vm.showFields).toBe(true);

            await wrapper.setProps({ object: mockCustomObject });
            expect(wrapper.vm.showFields).toBe(false);
        });
    });
});
