/**
 * Login View Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Login from '@/views/pages/auth/Login.vue';

// Mock useAuth
const mockLogin = vi.fn();
vi.mock('@/composables/auth/useAuth', () => ({
    useAuth: () => ({ login: mockLogin }),
}));

// Mock FloatingConfigurator
vi.mock('@/components/FloatingConfigurator.vue', () => ({
    default: {
        name: 'FloatingConfigurator',
        template: '<div class="floating-configurator-stub"></div>',
    },
}));

// Get router mock
const mockRouterPush = vi.fn();
vi.mock('vue-router', () => ({
    useRouter: () => ({ push: mockRouterPush }),
    useRoute: () => ({ params: {}, query: {}, path: '/auth/login' }),
}));

describe('Login View', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const mountComponent = () => {
        return mount(Login, {
            global: {
                stubs: {
                    InputText: true,
                    Password: true,
                    Checkbox: true,
                    Button: true,
                    FloatingConfigurator: true,
                },
            },
        });
    };

    describe('Rendering', () => {
        it('should mount successfully', () => {
            const wrapper = mountComponent();
            expect(wrapper.exists()).toBe(true);
        });

        it('should display Login title', () => {
            const wrapper = mountComponent();
            expect(wrapper.find('h3').text()).toBe('Login');
        });
    });

    describe('Login Flow', () => {
        it('should call login with credentials on handleLogin', async () => {
            mockLogin.mockResolvedValueOnce({ status: 200 });

            const wrapper = mountComponent();
            wrapper.vm.userIdentifier = 'user@test.com';
            wrapper.vm.password = 'password123';

            await wrapper.vm.handleLogin();

            expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'password123');
        });

        it('should redirect to /dashboard after successful login', async () => {
            mockLogin.mockResolvedValueOnce({ status: 200 });

            const wrapper = mountComponent();
            wrapper.vm.userIdentifier = 'user@test.com';
            wrapper.vm.password = 'pass';

            await wrapper.vm.handleLogin();
            vi.advanceTimersByTime(1000);

            expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
        });

        it('should redirect to /auth/access on non-200 response', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockLogin.mockResolvedValueOnce({
                status: 401,
                data: { message: 'Invalid credentials' },
            });

            const wrapper = mountComponent();
            await wrapper.vm.handleLogin();

            expect(mockRouterPush).toHaveBeenCalledWith('/auth/access');
            consoleSpy.mockRestore();
        });

        it('should redirect to /auth/access on 401 error', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockLogin.mockRejectedValueOnce({
                response: { status: 401 },
            });

            const wrapper = mountComponent();
            await wrapper.vm.handleLogin();

            expect(mockRouterPush).toHaveBeenCalledWith('/auth/access');
            consoleSpy.mockRestore();
        });

        it('should alert on non-401 error', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const originalAlert = window.alert;
            window.alert = vi.fn();
            mockLogin.mockRejectedValueOnce(new Error('Server down'));

            const wrapper = mountComponent();
            await wrapper.vm.handleLogin();

            expect(window.alert).toHaveBeenCalled();
            consoleSpy.mockRestore();
            window.alert = originalAlert;
        });
    });
});
