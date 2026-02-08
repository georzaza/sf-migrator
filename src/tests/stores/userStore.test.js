/**
 * User Store Tests
 *
 * Tests for authentication state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUserStore } from '@/stores/userStore';

describe('User Store', () => {
    let store;

    beforeEach(() => {
        setActivePinia(createPinia());
        store = useUserStore();
    });

    describe('Store Initialization', () => {
        it('should initialize with default state', () => {
            expect(store.isAuthenticated).toBe(false);
            expect(store.email).toBe('');
            expect(store.username).toBe('');
        });
    });

    describe('Actions', () => {
        it('setEmail should update the email', () => {
            store.setEmail('user@example.com');
            expect(store.email).toBe('user@example.com');
        });

        it('setUsername should update the username', () => {
            store.setUsername('john_doe');
            expect(store.username).toBe('john_doe');
        });

        it('setIsAuthenticated should update authentication status', () => {
            expect(store.isAuthenticated).toBe(false);

            store.setIsAuthenticated(true);
            expect(store.isAuthenticated).toBe(true);

            store.setIsAuthenticated(false);
            expect(store.isAuthenticated).toBe(false);
        });
    });
});
