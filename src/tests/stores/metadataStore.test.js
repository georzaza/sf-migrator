/**
 * Metadata Store Tests
 *
 * Tests for Salesforce metadata state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMetadataStore } from '@/stores/metadataStore';
import axiosInstance from '@/api/axiosInstance';

// Mock axios
vi.mock('@/api/axiosInstance');

describe('Metadata Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    describe('Store Initialization', () => {
        it('should initialize with default state', () => {
            const store = useMetadataStore();

            expect(store.sourceOrg).toBeNull();
            expect(store.targetOrg).toBeNull();
            expect(store.sourceObjects).toEqual([]);
            expect(store.targetObjects).toEqual([]);
            expect(store.sourceFields).toEqual({});
            expect(store.targetFields).toEqual({});
        });
    });

    describe('Org Selection', () => {
        it('should set source org and clear previous data', () => {
            const store = useMetadataStore();
            const org = { id: 'org-1', name: 'Test Org' };

            store.sourceObjects = [{ id: 'obj-1' }];
            store.setSourceOrg(org);

            expect(store.sourceOrg).toEqual(org);
            expect(store.sourceObjects).toEqual([]);
            expect(store.sourceFields).toEqual({});
        });

        it('should set target org and clear previous data', () => {
            const store = useMetadataStore();
            const org = { id: 'org-2', name: 'Target Org' };

            store.targetObjects = [{ id: 'obj-1' }];
            store.setTargetOrg(org);

            expect(store.targetOrg).toEqual(org);
            expect(store.targetObjects).toEqual([]);
            expect(store.targetFields).toEqual({});
        });
    });

    describe('Getters', () => {
        it('should return source analyzed status', () => {
            const store = useMetadataStore();

            expect(store.sourceAnalyzed).toBe(false);

            store.sourceObjects = [{ id: 'obj-1' }];
            expect(store.sourceAnalyzed).toBe(true);
        });

        it('should return ready for mapping status', () => {
            const store = useMetadataStore();

            expect(store.readyForMapping).toBe(false);

            store.sourceOrg = { id: 'org-1' };
            store.targetOrg = { id: 'org-2' };
            store.sourceObjects = [{ id: 'obj-1' }];
            store.targetObjects = [{ id: 'obj-2' }];

            expect(store.readyForMapping).toBe(true);
        });

        it('should filter custom and standard objects', () => {
            const store = useMetadataStore();

            store.sourceObjects = [
                { id: 'obj-1', objectName: 'Account', isCustom: false },
                { id: 'obj-2', objectName: 'Custom__c', isCustom: true },
                { id: 'obj-3', objectName: 'Contact', isCustom: false }
            ];

            expect(store.sourceCustomObjects).toHaveLength(1);
            expect(store.sourceStandardObjects).toHaveLength(2);
        });

        it('should return current source fields for selected object', () => {
            const store = useMetadataStore();
            const fields = [
                { id: 'field-1', fieldName: 'Name' },
                { id: 'field-2', fieldName: 'Email' }
            ];

            store.selectedSourceObject = { id: 'obj-1' };
            store.sourceFields = { 'obj-1': fields };

            expect(store.currentSourceFields).toEqual(fields);
        });
    });

    describe('Load Objects', () => {
        it('should load source objects successfully', async () => {
            const store = useMetadataStore();
            const mockObjects = [
                { id: 'obj-1', objectName: 'Account' },
                { id: 'obj-2', objectName: 'Contact' }
            ];

            store.sourceOrg = { id: 'org-1' };

            axiosInstance.get.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: mockObjects
                }
            });

            const result = await store.loadSourceObjects();

            expect(result).toEqual(mockObjects);
            expect(store.sourceObjects).toEqual(mockObjects);
            expect(axiosInstance.get).toHaveBeenCalledWith('/', {
                headers: {
                    action: 'get-objects',
                    orgid: 'org-1'
                },
                params: { includeFields: false }
            });
        });

        it('should handle error when loading objects', async () => {
            const store = useMetadataStore();
            store.sourceOrg = { id: 'org-1' };

            axiosInstance.get.mockResolvedValueOnce({
                data: {
                    success: false,
                    message: 'Failed to load objects'
                }
            });

            await expect(store.loadSourceObjects()).rejects.toThrow('Failed to load objects');
            expect(store.sourceError).toBe('Failed to load objects');
        });

        it('should throw error if no org selected', async () => {
            const store = useMetadataStore();

            await expect(store.loadSourceObjects()).rejects.toThrow('No source org selected');
        });
    });

    describe('Analyze Org', () => {
        it('should analyze source org successfully', async () => {
            const store = useMetadataStore();
            store.sourceOrg = { id: 'org-1' };

            const mockAnalysisResult = {
                objectsAnalyzed: 50,
                fieldsAnalyzed: 500
            };

            const mockObjects = [{ id: 'obj-1', objectName: 'Account' }];

            axiosInstance.post.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: mockAnalysisResult
                }
            });

            axiosInstance.get.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: mockObjects
                }
            });

            const result = await store.analyzeSourceOrg();

            expect(result).toEqual(mockAnalysisResult);
            expect(axiosInstance.post).toHaveBeenCalledWith(
                '/',
                {
                    orgId: 'org-1',
                    includeCustomOnly: false,
                    excludeManaged: true
                },
                { headers: { action: 'analyze-org' } }
            );
        });

        it('should analyze with custom options', async () => {
            const store = useMetadataStore();
            store.targetOrg = { id: 'org-2' };

            axiosInstance.post.mockResolvedValueOnce({
                data: { success: true, data: {} }
            });

            axiosInstance.get.mockResolvedValueOnce({
                data: { success: true, data: [] }
            });

            await store.analyzeTargetOrg({
                includeCustomOnly: true,
                excludeManaged: false
            });

            expect(axiosInstance.post).toHaveBeenCalledWith(
                '/',
                expect.objectContaining({
                    includeCustomOnly: true,
                    excludeManaged: false
                }),
                expect.any(Object)
            );
        });
    });

    describe('Load Fields', () => {
        it('should load source fields for object', async () => {
            const store = useMetadataStore();
            const mockFields = [
                { id: 'field-1', fieldName: 'Name' },
                { id: 'field-2', fieldName: 'Email' }
            ];

            axiosInstance.get.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: mockFields
                }
            });

            const result = await store.loadSourceFields('obj-1');

            expect(result).toEqual(mockFields);
            expect(store.sourceFields['obj-1']).toEqual(mockFields);
        });

        it('should select object and auto-load fields', async () => {
            const store = useMetadataStore();
            const object = { id: 'obj-1', objectName: 'Account' };
            const mockFields = [{ id: 'field-1', fieldName: 'Name' }];

            axiosInstance.get.mockResolvedValueOnce({
                data: { success: true, data: mockFields }
            });

            await store.selectSourceObject(object);

            expect(store.selectedSourceObject).toEqual(object);
            expect(store.sourceFields['obj-1']).toEqual(mockFields);
        });

        it('should not reload fields if already cached', async () => {
            const store = useMetadataStore();
            const object = { id: 'obj-1', objectName: 'Account' };

            store.sourceFields['obj-1'] = [{ id: 'field-1' }];

            await store.selectSourceObject(object);

            expect(axiosInstance.get).not.toHaveBeenCalled();
        });
    });

    describe('Test Connection', () => {
        it('should test source connection successfully', async () => {
            const store = useMetadataStore();
            store.sourceOrg = { id: 'org-1' };

            const mockResult = {
                success: true,
                organizationId: '00D000000000001'
            };

            axiosInstance.post.mockResolvedValueOnce({
                data: { success: true, data: mockResult }
            });

            const result = await store.testSourceConnection();

            expect(result).toEqual(mockResult);
            expect(axiosInstance.post).toHaveBeenCalledWith(
                '/',
                { orgId: 'org-1' },
                { headers: { action: 'test-sf-connection' } }
            );
        });
    });

    describe('Reset Functions', () => {
        it('should reset source metadata only', () => {
            const store = useMetadataStore();

            store.sourceOrg = { id: 'org-1' };
            store.targetOrg = { id: 'org-2' };
            store.sourceObjects = [{ id: 'obj-1' }];
            store.targetObjects = [{ id: 'obj-2' }];

            store.resetSource();

            expect(store.sourceOrg).toBeNull();
            expect(store.sourceObjects).toEqual([]);
            expect(store.targetOrg).toEqual({ id: 'org-2' });
            expect(store.targetObjects).toEqual([{ id: 'obj-2' }]);
        });

        it('should reset target metadata only', () => {
            const store = useMetadataStore();

            store.sourceOrg = { id: 'org-1' };
            store.targetOrg = { id: 'org-2' };

            store.resetTarget();

            expect(store.sourceOrg).toEqual({ id: 'org-1' });
            expect(store.targetOrg).toBeNull();
        });
    });

    describe('Statistics', () => {
        it('should load source statistics', async () => {
            const store = useMetadataStore();
            store.sourceOrg = { id: 'org-1' };

            const mockStats = {
                totalObjects: 100,
                customObjects: 25,
                totalFields: 1500
            };

            axiosInstance.get.mockResolvedValueOnce({
                data: { success: true, data: mockStats }
            });

            const result = await store.loadSourceStats();

            expect(result).toEqual(mockStats);
            expect(store.sourceStats).toEqual(mockStats);
        });
    });
});
