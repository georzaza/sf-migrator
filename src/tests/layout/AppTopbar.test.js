/**
 * AppTopbar Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppTopbar from '@/layout/AppTopbar.vue';
import axiosInstance from '@/api/axiosInstance';

vi.mock('@/api/axiosInstance');

// Mock layout composable
vi.mock('@/layout/composables/layout', () => ({
    useLayout: () => ({
        toggleDarkMode: vi.fn(),
        isDarkTheme: { value: false },
    }),
}));

// Mock AppConfigurator
vi.mock('@/layout/AppConfigurator.vue', () => ({
    default: {
        name: 'AppConfigurator',
        template: '<div class="app-configurator-stub"></div>',
    },
}));

const mockRouterPush = vi.fn();
vi.mock('vue-router', () => ({
    useRouter: () => ({ push: mockRouterPush }),
    useRoute: () => ({ params: {}, query: {}, path: '/dashboard' }),
}));

describe('AppTopbar', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        // Mock localStorage/sessionStorage
        vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const mountComponent = () => {
        return mount(AppTopbar, {
            global: {
                stubs: {
                    'router-link': {
                        template: '<a class="router-link-stub"><slot /></a>',
                        props: ['to'],
                    },
                    AppConfigurator: true,
                },
                directives: {
                    styleclass: {},
                },
            },
        });
    };

    describe('Rendering', () => {
        it('should mount successfully', () => {
            const wrapper = mountComponent();
            expect(wrapper.exists()).toBe(true);
        });

        it('should have layout-topbar class', () => {
            const wrapper = mountComponent();
            expect(wrapper.find('.layout-topbar').exists()).toBe(true);
        });

        it('should contain logo section', () => {
            const wrapper = mountComponent();
            expect(wrapper.find('.layout-topbar-logo-container').exists()).toBe(true);
        });

        it('should display SAKAI brand name', () => {
            const wrapper = mountComponent();
            expect(wrapper.text()).toContain('SAKAI');
        });
    });

    describe('Logout', () => {
        it('should clear localStorage and sessionStorage on logout', async () => {
            axiosInstance.get.mockResolvedValueOnce({ status: 200 });
            const localClearSpy = vi.spyOn(Storage.prototype, 'clear');

            const wrapper = mountComponent();
            await wrapper.vm.logout();

            expect(localClearSpy).toHaveBeenCalled();
            localClearSpy.mockRestore();
        });

        it('should call logout API endpoint', async () => {
            axiosInstance.get.mockResolvedValueOnce({ status: 200 });

            const wrapper = mountComponent();
            await wrapper.vm.logout();

            expect(axiosInstance.get).toHaveBeenCalledWith('/auth/logout', {
                headers: { action: 'logout' },
                withCredentials: true,
            });
        });
    });
});
