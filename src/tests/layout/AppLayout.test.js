/**
 * AppLayout Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AppLayout from '@/layout/AppLayout.vue';

// Mock child components
vi.mock('@/layout/AppTopbar.vue', () => ({
    default: {
        name: 'AppTopbar',
        template: '<div class="topbar-stub"></div>',
    },
}));

vi.mock('@/layout/AppFooter.vue', () => ({
    default: {
        name: 'AppFooter',
        template: '<div class="footer-stub"></div>',
    },
}));

describe('AppLayout', () => {
    const mountComponent = () => {
        return mount(AppLayout, {
            global: {
                stubs: {
                    'router-view': { template: '<div class="router-view-stub"></div>' },
                    Toast: true,
                },
            },
        });
    };

    it('should mount successfully', () => {
        const wrapper = mountComponent();
        expect(wrapper.exists()).toBe(true);
    });

    it('should have layout-wrapper class', () => {
        const wrapper = mountComponent();
        expect(wrapper.find('.layout-wrapper').exists()).toBe(true);
    });

    it('should have layout-static classes (sidebar removed)', () => {
        const wrapper = mountComponent();
        const layoutWrapper = wrapper.find('.layout-wrapper');
        expect(layoutWrapper.classes()).toContain('layout-static');
        expect(layoutWrapper.classes()).toContain('layout-static-inactive');
    });

    it('should render topbar', () => {
        const wrapper = mountComponent();
        expect(wrapper.find('.topbar-stub').exists()).toBe(true);
    });

    it('should render footer', () => {
        const wrapper = mountComponent();
        expect(wrapper.find('.footer-stub').exists()).toBe(true);
    });

    it('should render main content area', () => {
        const wrapper = mountComponent();
        expect(wrapper.find('.layout-main-container').exists()).toBe(true);
        expect(wrapper.find('.layout-main').exists()).toBe(true);
    });

    it('should render router-view inside layout-main', () => {
        const wrapper = mountComponent();
        expect(wrapper.find('.layout-main .router-view-stub').exists()).toBe(true);
    });
});
