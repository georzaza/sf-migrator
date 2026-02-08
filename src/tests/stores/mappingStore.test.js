/**
 * Mapping Store Tests
 *
 * Tests for object and field mapping state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMappingStore } from '@/stores/mappingStore';
import axiosInstance from '@/api/axiosInstance';

// Mock axios
vi.mock('@/api/axiosInstance');

describe('Mapping Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    describe('Store Initialization', () => {
        it('should initialize with default state', () => {
            const store = useMappingStore();

            expect(store.objectMappings).toEqual([]);
            expect(store.fieldMappings).toEqual([]);
            expect(store.currentObjectMapping).toBeNull();
            expect(store.loadingMappings).toBe(false);
        });
    });

    describe('Getters', () => {
        it('should return current field mappings', () => {
            const store = useMappingStore();

            store.currentObjectMapping = { id: 'om-1' };
            store.fieldMappings = [
                { id: 'fm-1', objectMappingId: 'om-1' },
                { id: 'fm-2', objectMappingId: 'om-2' },
                { id: 'fm-3', objectMappingId: 'om-1' }
            ];

            expect(store.currentFieldMappings).toHaveLength(2);
            expect(store.currentFieldMappings[0].id).toBe('fm-1');
        });

        it('should get field mappings by object mapping ID', () => {
            const store = useMappingStore();

            store.fieldMappings = [
                { id: 'fm-1', objectMappingId: 'om-1' },
                { id: 'fm-2', objectMappingId: 'om-2' }
            ];

            const mappings = store.getFieldMappingsByObjectMapping('om-1');
            expect(mappings).toHaveLength(1);
            expect(mappings[0].id).toBe('fm-1');
        });

        it('should find object mapping by source and target', () => {
            const store = useMappingStore();

            store.objectMappings = [
                {
                    id: 'om-1',
                    sourceObjectId: 'obj-1',
                    targetObjectId: 'obj-2'
                },
                {
                    id: 'om-2',
                    sourceObjectId: 'obj-3',
                    targetObjectId: 'obj-4'
                }
            ];

            const mapping = store.getObjectMapping('obj-1', 'obj-2');
            expect(mapping.id).toBe('om-1');
        });

        it('should check if field mapping exists', () => {
            const store = useMappingStore();

            store.fieldMappings = [
                {
                    objectMappingId: 'om-1',
                    sourceFieldId: 'field-1'
                }
            ];

            expect(store.hasFieldMapping('om-1', 'field-1')).toBe(true);
            expect(store.hasFieldMapping('om-1', 'field-2')).toBe(false);
        });

        it('should return active object mappings', () => {
            const store = useMappingStore();

            store.objectMappings = [
                { id: 'om-1', isActive: true },
                { id: 'om-2', isActive: false },
                { id: 'om-3', isActive: true }
            ];

            expect(store.activeObjectMappings).toHaveLength(2);
        });

        it('should calculate mapping statistics', () => {
            const store = useMappingStore();

            store.fieldMappings = [
                { mappingType: 'direct' },
                { mappingType: 'direct' },
                { mappingType: 'expression' },
                { mappingType: 'constant' }
            ];

            const stats = store.mappingStatistics;
            expect(stats.total).toBe(4);
            expect(stats.direct).toBe(2);
            expect(stats.expression).toBe(1);
            expect(stats.constant).toBe(1);
        });
    });

    describe('Load Mappings', () => {
        it('should load all mappings for project', async () => {
            const store = useMappingStore();
            const mockObjectMappings = [
                { id: 'om-1', sourceObjectId: 'obj-1', targetObjectId: 'obj-2' }
            ];
            const mockFieldMappings = [
                { id: 'fm-1', objectMappingId: 'om-1' }
            ];

            axiosInstance.post
                .mockResolvedValueOnce({
                    data: { success: true, data: mockObjectMappings }
                })
                .mockResolvedValueOnce({
                    data: { success: true, data: mockFieldMappings }
                });

            const result = await store.loadMappings('project-1');

            expect(result.objectMappings).toEqual(mockObjectMappings);
            expect(result.fieldMappings).toEqual(mockFieldMappings);
            expect(store.objectMappings).toEqual(mockObjectMappings);
            expect(store.fieldMappings).toEqual(mockFieldMappings);
        });

        it('should throw error if project ID missing', async () => {
            const store = useMappingStore();

            await expect(store.loadMappings()).rejects.toThrow('Project ID is required');
        });
    });

    describe('Object Mapping CRUD', () => {
        it('should create object mapping', async () => {
            const store = useMappingStore();
            const newMapping = {
                id: 'om-1',
                projectId: 'project-1',
                sourceObjectId: 'obj-1',
                targetObjectId: 'obj-2',
                isActive: true
            };

            axiosInstance.put.mockResolvedValueOnce({
                data: { success: true, data: newMapping }
            });

            const result = await store.createObjectMapping({
                projectId: 'project-1',
                sourceObjectId: 'obj-1',
                targetObjectId: 'obj-2'
            });

            expect(result).toEqual(newMapping);
            expect(store.objectMappings).toContainEqual(newMapping);
            expect(store.currentObjectMapping).toEqual(newMapping);
        });

        it('should update object mapping', async () => {
            const store = useMappingStore();
            const updatedData = { isActive: false };

            store.objectMappings = [
                { id: 'om-1', isActive: true }
            ];

            axiosInstance.post.mockResolvedValueOnce({
                data: { success: true, data: updatedData }
            });

            await store.updateObjectMapping('om-1', updatedData);

            expect(store.objectMappings[0].isActive).toBe(false);
        });

        it('should delete object mapping and related field mappings', async () => {
            const store = useMappingStore();

            store.objectMappings = [{ id: 'om-1' }];
            store.fieldMappings = [
                { id: 'fm-1', objectMappingId: 'om-1' },
                { id: 'fm-2', objectMappingId: 'om-2' }
            ];
            store.currentObjectMapping = { id: 'om-1' };

            axiosInstance.request.mockResolvedValueOnce({
                data: { success: true }
            });

            await store.deleteObjectMapping('om-1');

            expect(store.objectMappings).toHaveLength(0);
            expect(store.fieldMappings).toHaveLength(1);
            expect(store.fieldMappings[0].id).toBe('fm-2');
            expect(store.currentObjectMapping).toBeNull();
        });
    });

    describe('Field Mapping CRUD', () => {
        it('should create field mapping', async () => {
            const store = useMappingStore();
            const newMapping = {
                id: 'fm-1',
                objectMappingId: 'om-1',
                sourceFieldId: 'field-1',
                targetFieldId: 'field-2',
                mappingType: 'direct'
            };

            axiosInstance.put.mockResolvedValueOnce({
                data: { success: true, data: newMapping }
            });

            const result = await store.createFieldMapping({
                objectMappingId: 'om-1',
                sourceFieldId: 'field-1',
                targetFieldId: 'field-2',
                mappingType: 'direct'
            });

            expect(result).toEqual(newMapping);
            expect(store.fieldMappings).toContainEqual(newMapping);
        });

        it('should throw error if required fields missing', async () => {
            const store = useMappingStore();

            await expect(
                store.createFieldMapping({ sourceFieldId: 'field-1' })
            ).rejects.toThrow('Missing required fields');
        });

        it('should update field mapping', async () => {
            const store = useMappingStore();

            store.fieldMappings = [
                { id: 'fm-1', mappingType: 'direct' }
            ];

            axiosInstance.post.mockResolvedValueOnce({
                data: { success: true, data: {} }
            });

            await store.updateFieldMapping('fm-1', { mappingType: 'expression' });

            expect(store.fieldMappings[0].mappingType).toBe('expression');
        });

        it('should delete field mapping', async () => {
            const store = useMappingStore();

            store.fieldMappings = [
                { id: 'fm-1' },
                { id: 'fm-2' }
            ];

            axiosInstance.request.mockResolvedValueOnce({
                data: { success: true }
            });

            await store.deleteFieldMapping('fm-1');

            expect(store.fieldMappings).toHaveLength(1);
            expect(store.fieldMappings[0].id).toBe('fm-2');
        });
    });

    describe('Specialized Mapping Methods', () => {
        it('should create direct mapping', async () => {
            const store = useMappingStore();

            const sourceField = { id: 'field-1', fieldName: 'Name' };
            const targetField = { id: 'field-2', fieldName: 'Name' };

            axiosInstance.put.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        id: 'fm-1',
                        mappingType: 'direct'
                    }
                }
            });

            const result = await store.createDirectMapping(
                'om-1',
                sourceField,
                targetField
            );

            expect(result.mappingType).toBe('direct');
            expect(axiosInstance.put).toHaveBeenCalledWith(
                '/',
                expect.objectContaining({
                    objectMappingId: 'om-1',
                    sourceFieldId: 'field-1',
                    targetFieldId: 'field-2',
                    mappingType: 'direct'
                }),
                expect.any(Object)
            );
        });

        it('should create expression mapping', async () => {
            const store = useMappingStore();

            axiosInstance.put.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: { id: 'fm-1', mappingType: 'expression' }
                }
            });

            await store.createExpressionMapping(
                'om-1',
                { id: 'field-1' },
                { id: 'field-2' },
                'UPPER(sourceField)'
            );

            expect(axiosInstance.put).toHaveBeenCalledWith(
                '/',
                expect.objectContaining({
                    mappingType: 'expression',
                    transformExpression: 'UPPER(sourceField)'
                }),
                expect.any(Object)
            );
        });

        it('should create constant mapping', async () => {
            const store = useMappingStore();

            axiosInstance.put.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: { id: 'fm-1', mappingType: 'constant' }
                }
            });

            await store.createConstantMapping(
                'om-1',
                { id: 'field-2' },
                'DEFAULT_VALUE'
            );

            expect(axiosInstance.put).toHaveBeenCalledWith(
                '/',
                expect.objectContaining({
                    mappingType: 'constant',
                    constantValue: 'DEFAULT_VALUE',
                    sourceFieldId: null
                }),
                expect.any(Object)
            );
        });
    });

    describe('Auto-Mapping', () => {
        it('should auto-map fields by matching names', async () => {
            const store = useMappingStore();

            const sourceFields = [
                { id: 'sf-1', fieldName: 'Name' },
                { id: 'sf-2', fieldName: 'Email' },
                { id: 'sf-3', fieldName: 'Phone' }
            ];

            const targetFields = [
                { id: 'tf-1', fieldName: 'Name' },
                { id: 'tf-2', fieldName: 'Email' },
                { id: 'tf-3', fieldName: 'Address' }
            ];

            axiosInstance.put
                .mockResolvedValueOnce({
                    data: { success: true, data: { id: 'fm-1' } }
                })
                .mockResolvedValueOnce({
                    data: { success: true, data: { id: 'fm-2' } }
                });

            const result = await store.autoMapFields(
                'om-1',
                sourceFields,
                targetFields
            );

            expect(result.success).toBe(2);
            expect(result.failed).toBe(0);
        });

        it('should handle case-insensitive auto-mapping', async () => {
            const store = useMappingStore();

            const sourceFields = [
                { id: 'sf-1', fieldName: 'NAME' }
            ];

            const targetFields = [
                { id: 'tf-1', fieldName: 'name' }
            ];

            axiosInstance.put.mockResolvedValueOnce({
                data: { success: true, data: { id: 'fm-1' } }
            });

            const result = await store.autoMapFields(
                'om-1',
                sourceFields,
                targetFields,
                { caseSensitive: false }
            );

            expect(result.success).toBe(1);
        });
    });

    describe('Bulk Operations', () => {
        it('should bulk create field mappings', async () => {
            const store = useMappingStore();

            const mappings = [
                { objectMappingId: 'om-1', sourceFieldId: 'f1', targetFieldId: 'f2', mappingType: 'direct' },
                { objectMappingId: 'om-1', sourceFieldId: 'f3', targetFieldId: 'f4', mappingType: 'direct' }
            ];

            axiosInstance.put
                .mockResolvedValueOnce({
                    data: { success: true, data: { id: 'fm-1' } }
                })
                .mockResolvedValueOnce({
                    data: { success: true, data: { id: 'fm-2' } }
                });

            const result = await store.bulkCreateFieldMappings(mappings);

            expect(result.success).toBe(2);
            expect(result.failed).toBe(0);
            expect(result.results).toHaveLength(2);
        });

        it('should handle errors in bulk operations', async () => {
            const store = useMappingStore();

            const mappings = [
                { objectMappingId: 'om-1', sourceFieldId: 'f1', targetFieldId: 'f2', mappingType: 'direct' }
            ];

            // Clear previous mocks and set up a rejection
            axiosInstance.put.mockClear();
            axiosInstance.put.mockRejectedValueOnce(new Error('API Error'));

            const result = await store.bulkCreateFieldMappings(mappings);

            expect(result.success).toBe(0);
            expect(result.failed).toBe(1);
            expect(result.errors).toHaveLength(1);
        });
    });

    describe('Store Management', () => {
        it('should set current object mapping', () => {
            const store = useMappingStore();
            const mapping = { id: 'om-1' };

            store.setCurrentObjectMapping(mapping);

            expect(store.currentObjectMapping).toEqual(mapping);
        });

        it('should clear current mapping', () => {
            const store = useMappingStore();

            store.currentObjectMapping = { id: 'om-1' };
            store.clearCurrentMapping();

            expect(store.currentObjectMapping).toBeNull();
        });
    });
});
