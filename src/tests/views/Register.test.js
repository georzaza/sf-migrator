/**
 * Register View Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Register from '@/views/pages/auth/Register.vue';
import axiosInstance from '@/api/axiosInstance';

vi.mock('@/api/axiosInstance');

// Mock useAuth
const mockLogin = vi.fn();
vi.mock('@/composables/auth/useAuth', () => ({
    useAuth: () => ({ login: mockLogin }),
}));

vi.mock('@/components/FloatingConfigurator.vue', () => ({
    default: {
        name: 'FloatingConfigurator',
        template: '<div class="floating-configurator-stub"></div>',
    },
}));

const mockRouterPush = vi.fn();
vi.mock('vue-router', () => ({
    useRouter: () => ({ push: mockRouterPush }),
    useRoute: () => ({ params: {}, query: {}, path: '/auth/register' }),
}));

describe('Register View', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const mountComponent = () => {
        return mount(Register, {
            global: {
                stubs: {
                    InputText: true,
                    Password: true,
                    Button: true,
                    Message: true,
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

        it('should display Register title', () => {
            const wrapper = mountComponent();
            expect(wrapper.find('h3').text()).toBe('Register');
        });
    });

    describe('Registration Flow', () => {
        it('should call register API with correct payload', async () => {
            axiosInstance.post.mockResolvedValueOnce({
                status: 201,
                data: { success: true },
            });
            mockLogin.mockResolvedValueOnce({ status: 200 });

            const wrapper = mountComponent();
            wrapper.vm.email = 'user@test.com';
            wrapper.vm.password = 'Pass123!';
            wrapper.vm.firstname = 'John';
            wrapper.vm.lastname = 'Doe';
            wrapper.vm.username = 'johndoe';

            await wrapper.vm.handleRegister();

            expect(axiosInstance.post).toHaveBeenCalledWith(
                '/auth/register',
                {
                    email: 'user@test.com',
                    password: 'Pass123!',
                    firstname: 'John',
                    lastname: 'Doe',
                    username: 'johndoe',
                },
                { headers: { action: 'register' } }
            );
        });

        it('should auto-login and redirect after successful registration', async () => {
            axiosInstance.post.mockResolvedValueOnce({ status: 201 });
            mockLogin.mockResolvedValueOnce({ status: 200 });

            const wrapper = mountComponent();
            wrapper.vm.email = 'user@test.com';
            wrapper.vm.password = 'Pass123!';
            wrapper.vm.firstname = 'John';
            wrapper.vm.lastname = 'Doe';
            wrapper.vm.username = 'johndoe';

            await wrapper.vm.handleRegister();
            vi.advanceTimersByTime(1000);

            expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'Pass123!');
            expect(mockRouterPush).toHaveBeenCalledWith('/');
        });

        it('should set userExists on 409 response', async () => {
            axiosInstance.post.mockResolvedValueOnce({
                status: 409,
                data: { message: 'User already exists' },
            });

            const wrapper = mountComponent();
            await wrapper.vm.handleRegister();

            expect(wrapper.vm.userExists).toBe(true);
        });

        it('should set formErrorEmail on email-related 400', async () => {
            axiosInstance.post.mockResolvedValueOnce({
                status: 400,
                data: { message: 'Invalid email format.' },
            });
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const wrapper = mountComponent();
            await wrapper.vm.handleRegister();

            expect(wrapper.vm.formErrorEmail).toBe(true);
            consoleSpy.mockRestore();
        });

        it('should set formErrorMissingInput on missing fields', async () => {
            axiosInstance.post.mockResolvedValueOnce({
                status: 400,
                data: { message: 'All fields are required.' },
            });
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const wrapper = mountComponent();
            await wrapper.vm.handleRegister();

            expect(wrapper.vm.formErrorMissingInput).toBe(true);
            consoleSpy.mockRestore();
        });

        it('should set formErrorUsername on username validation error', async () => {
            axiosInstance.post.mockResolvedValueOnce({
                status: 400,
                data: { message: 'Username is required.' },
            });
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const wrapper = mountComponent();
            await wrapper.vm.handleRegister();

            expect(wrapper.vm.formErrorUsername).toBe(true);
            consoleSpy.mockRestore();
        });

        it('should set formErrorPassword on password validation error', async () => {
            axiosInstance.post.mockResolvedValueOnce({
                status: 400,
                data: { message: 'Password must contain at least one uppercase letter.' },
            });
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const wrapper = mountComponent();
            await wrapper.vm.handleRegister();

            expect(wrapper.vm.formErrorPassword).toBe(true);
            consoleSpy.mockRestore();
        });

        it('should clear all error flags before each submit', async () => {
            // First submission: cause an error
            axiosInstance.post.mockResolvedValueOnce({
                status: 409,
                data: { message: 'User exists' },
            });
            const wrapper = mountComponent();
            await wrapper.vm.handleRegister();
            expect(wrapper.vm.userExists).toBe(true);

            // Second submission: should reset before trying
            axiosInstance.post.mockResolvedValueOnce({
                status: 201,
            });
            mockLogin.mockResolvedValueOnce({ status: 200 });

            await wrapper.vm.handleRegister();
            expect(wrapper.vm.userExists).toBe(false);
        });

        it('should handle network error', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const originalAlert = window.alert;
            window.alert = vi.fn();
            axiosInstance.post.mockRejectedValueOnce(new Error('Network Error'));

            const wrapper = mountComponent();
            await wrapper.vm.handleRegister();

            expect(window.alert).toHaveBeenCalled();
            consoleSpy.mockRestore();
            window.alert = originalAlert;
        });
    });
});
