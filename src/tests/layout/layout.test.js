/**
 * Layout Composable Tests
 *
 * Tests for useLayout composable (dark mode, menu toggle, reactive state)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLayout } from '@/layout/composables/layout';

describe('useLayout Composable', () => {
    let layout;

    beforeEach(() => {
        layout = useLayout();
        // Reset state between tests
        layout.layoutConfig.darkTheme = false;
        layout.layoutState.staticMenuDesktopInactive = false;
        layout.layoutState.overlayMenuActive = false;
        layout.layoutState.staticMenuMobileActive = false;
    });

    describe('Initialization', () => {
        it('should return all expected properties', () => {
            expect(layout).toHaveProperty('layoutConfig');
            expect(layout).toHaveProperty('layoutState');
            expect(layout).toHaveProperty('toggleMenu');
            expect(layout).toHaveProperty('isSidebarActive');
            expect(layout).toHaveProperty('isDarkTheme');
            expect(layout).toHaveProperty('getPrimary');
            expect(layout).toHaveProperty('getSurface');
            expect(layout).toHaveProperty('setActiveMenuItem');
            expect(layout).toHaveProperty('toggleDarkMode');
        });

        it('should have correct default config', () => {
            expect(layout.layoutConfig.preset).toBe('Aura');
            expect(layout.layoutConfig.primary).toBe('emerald');
            expect(layout.layoutConfig.menuMode).toBe('static');
        });
    });

    describe('isDarkTheme', () => {
        it('should return false by default', () => {
            expect(layout.isDarkTheme.value).toBe(false);
        });

        it('should reflect layoutConfig.darkTheme', () => {
            layout.layoutConfig.darkTheme = true;
            expect(layout.isDarkTheme.value).toBe(true);
        });
    });

    describe('setActiveMenuItem', () => {
        it('should set active menu item from value', () => {
            layout.setActiveMenuItem('dashboard');
            expect(layout.layoutState.activeMenuItem).toBe('dashboard');
        });

        it('should set active menu item from object with value property', () => {
            layout.setActiveMenuItem({ value: 'migrate' });
            expect(layout.layoutState.activeMenuItem).toBe('migrate');
        });
    });

    describe('toggleMenu', () => {
        it('should toggle overlay menu when in overlay mode', () => {
            layout.layoutConfig.menuMode = 'overlay';
            expect(layout.layoutState.overlayMenuActive).toBe(false);

            layout.toggleMenu();
            expect(layout.layoutState.overlayMenuActive).toBe(true);

            layout.toggleMenu();
            expect(layout.layoutState.overlayMenuActive).toBe(false);
        });

        it('should toggle static desktop inactive on wide screens', () => {
            layout.layoutConfig.menuMode = 'static';
            // Mock window.innerWidth > 991
            Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });

            layout.toggleMenu();
            expect(layout.layoutState.staticMenuDesktopInactive).toBe(true);
        });

        it('should toggle mobile menu on narrow screens', () => {
            layout.layoutConfig.menuMode = 'static';
            Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });

            layout.toggleMenu();
            expect(layout.layoutState.staticMenuMobileActive).toBe(true);
        });
    });

    describe('isSidebarActive', () => {
        it('should return false when no menu is active', () => {
            expect(layout.isSidebarActive.value).toBe(false);
        });

        it('should return true when overlay menu is active', () => {
            layout.layoutState.overlayMenuActive = true;
            expect(layout.isSidebarActive.value).toBe(true);
        });

        it('should return true when mobile menu is active', () => {
            layout.layoutState.staticMenuMobileActive = true;
            expect(layout.isSidebarActive.value).toBe(true);
        });
    });

    describe('getPrimary / getSurface', () => {
        it('getPrimary should reflect config', () => {
            expect(layout.getPrimary.value).toBe('emerald');
            layout.layoutConfig.primary = 'blue';
            expect(layout.getPrimary.value).toBe('blue');
        });

        it('getSurface should reflect config', () => {
            expect(layout.getSurface.value).toBeNull();
            layout.layoutConfig.surface = 'slate';
            expect(layout.getSurface.value).toBe('slate');
        });
    });
});
