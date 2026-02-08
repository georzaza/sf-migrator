/**
 * Frontend Test Setup
 *
 * Initializes the test environment for Vue component and store tests
 */

import { config } from '@vue/test-utils';
import { vi } from 'vitest';

// Mock PrimeVue components globally
config.global.stubs = {
    Dialog: true,
    Button: true,
    InputText: true,
    Select: true,
    DataTable: true,
    Column: true,
    Textarea: true,
    Tag: true,
    Checkbox: true,
    Password: true,
    ProgressSpinner: true,
    Message: true,
    Divider: true,
    Toast: true,
    Card: true,
    Badge: true,
};

// Stub directives used by PrimeVue
config.global.directives = {
    tooltip: {},
    styleclass: {},
};

// Mock PrimeVue useToast composable
vi.mock('primevue/usetoast', () => ({
    useToast: () => ({
        add: vi.fn(),
        removeGroup: vi.fn(),
        removeAllGroups: vi.fn(),
    }),
}));

// Mock axios
vi.mock('@/api/axiosInstance', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        request: vi.fn(),
    }
}));

// Mock router
vi.mock('vue-router', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        go: vi.fn(),
        back: vi.fn()
    }),
    useRoute: () => ({
        params: {},
        query: {},
        path: '/'
    })
}));
