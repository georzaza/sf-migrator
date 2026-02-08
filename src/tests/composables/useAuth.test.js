/**
 * useAuth Composable Tests
 *
 * Tests for login flow and isLoggedIn authentication check
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuth, isLoggedIn } from '@/composables/auth/useAuth';
import { useUserStore } from '@/stores/userStore';
import { useOrgStore } from '@/stores/orgStore';
import axiosInstance from '@/api/axiosInstance';

vi.mock('@/api/axiosInstance');

describe('useAuth Composable', () => {
    let userStore;
    let orgStore;

    beforeEach(() => {
        setActivePinia(createPinia());
        userStore = useUserStore();
        orgStore = useOrgStore();
        vi.clearAllMocks();
    });

    describe('login', () => {
        it('should login successfully and set user state', async () => {
            axiosInstance.post.mockResolvedValueOnce({ status: 200 });
            axiosInstance.get.mockResolvedValueOnce({
                status: 200,
                data: {
                    data: { email: 'user@test.com', username: 'testuser' },
                },
            });

            // Mock loadProjects on orgStore
            vi.spyOn(orgStore, 'loadProjects').mockResolvedValue();

            const { login } = useAuth();
            const result = await login('user@test.com', 'password123');

            expect(result.status).toBe(200);
            expect(userStore.isAuthenticated).toBe(true);
            expect(userStore.email).toBe('user@test.com');
            expect(userStore.username).toBe('testuser');
        });

        it('should call login endpoint with correct payload', async () => {
            axiosInstance.post.mockResolvedValueOnce({ status: 200 });
            axiosInstance.get.mockResolvedValueOnce({
                status: 200,
                data: { data: { email: 'a@b.com', username: 'ab' } },
            });
            vi.spyOn(orgStore, 'loadProjects').mockResolvedValue();

            const { login } = useAuth();
            await login('a@b.com', 'pass');

            expect(axiosInstance.post).toHaveBeenCalledWith(
                '/auth/login',
                { userIdentifier: 'a@b.com', password: 'pass' },
                { headers: { action: 'login' } }
            );
        });

        it('should return loginResponse if status is not 200', async () => {
            const badResponse = { status: 401, data: { message: 'Invalid' } };
            axiosInstance.post.mockResolvedValueOnce(badResponse);

            const { login } = useAuth();
            const result = await login('wrong', 'creds');

            expect(result).toEqual(badResponse);
            expect(userStore.isAuthenticated).toBe(false);
        });

        it('should return null on network error', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            axiosInstance.post.mockRejectedValueOnce(new Error('Network Error'));

            const { login } = useAuth();
            const result = await login('user', 'pass');

            expect(result).toBeNull();
            consoleSpy.mockRestore();
        });

        it('should call loadProjects after successful login', async () => {
            axiosInstance.post.mockResolvedValueOnce({ status: 200 });
            axiosInstance.get.mockResolvedValueOnce({
                status: 200,
                data: { data: { email: 'u@t.com', username: 'u' } },
            });
            const loadSpy = vi.spyOn(orgStore, 'loadProjects').mockResolvedValue();

            const { login } = useAuth();
            await login('u@t.com', 'p');

            expect(loadSpy).toHaveBeenCalled();
        });
    });

    describe('isLoggedIn', () => {
        it('should return true and set user state when authenticated', async () => {
            axiosInstance.get.mockResolvedValueOnce({
                status: 200,
                data: {
                    data: { email: 'user@test.com', username: 'testuser' },
                },
            });

            const result = await isLoggedIn();

            expect(result).toBe(true);
            expect(userStore.isAuthenticated).toBe(true);
            expect(userStore.email).toBe('user@test.com');
            expect(userStore.username).toBe('testuser');
        });

        it('should return false when whoami returns non-200', async () => {
            axiosInstance.get.mockResolvedValueOnce({ status: 401 });

            const result = await isLoggedIn();

            expect(result).toBe(false);
        });

        it('should return false on network error', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            axiosInstance.get.mockRejectedValueOnce(new Error('Network Error'));

            const result = await isLoggedIn();

            expect(result).toBe(false);
            consoleSpy.mockRestore();
        });

        it('should call whoami with correct headers', async () => {
            axiosInstance.get.mockResolvedValueOnce({
                status: 200,
                data: { data: { email: 'e', username: 'u' } },
            });

            await isLoggedIn();

            expect(axiosInstance.get).toHaveBeenCalledWith('/auth/whoami', {
                headers: { action: 'whoami' },
                withCredentials: true,
            });
        });
    });
});
