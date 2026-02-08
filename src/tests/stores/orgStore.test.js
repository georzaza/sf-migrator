/**
 * Org Store Tests
 *
 * Tests for project/org state management, CRUD operations, and dialog controls
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useOrgStore } from '@/stores/orgStore';
import axiosInstance from '@/api/axiosInstance';

vi.mock('@/api/axiosInstance');

describe('Org Store', () => {
    let store;

    beforeEach(() => {
        setActivePinia(createPinia());
        store = useOrgStore();
        vi.clearAllMocks();
    });

    describe('Store Initialization', () => {
        it('should initialize with default state', () => {
            expect(store.projects).toEqual([]);
            expect(store.orgs).toEqual([]);
            expect(store.selectedProject).toBeNull();
            expect(store.selectedOrg).toBeNull();
            expect(store.showEditOrgDialog).toBe(false);
            expect(store.showAddProjectDialog).toBe(false);
            expect(store.showAddOrgDialog).toBe(false);
        });
    });

    describe('Getters', () => {
        it('projectOrgs should return empty array when no project selected', () => {
            store.orgs = [{ id: 'org-1', projectId: 'p-1' }];
            store.selectedProject = null;

            expect(store.projectOrgs).toEqual([]);
        });

        it('projectOrgs should filter orgs by selected project', () => {
            store.orgs = [
                { id: 'org-1', projectId: 'p-1' },
                { id: 'org-2', projectId: 'p-2' },
                { id: 'org-3', projectId: 'p-1' },
            ];
            store.selectedProject = { id: 'p-1', name: 'Project 1' };

            const result = store.projectOrgs;
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('org-1');
            expect(result[1].id).toBe('org-3');
        });

        it('projectOrgs should return empty array when no orgs match', () => {
            store.orgs = [{ id: 'org-1', projectId: 'p-2' }];
            store.selectedProject = { id: 'p-1' };

            expect(store.projectOrgs).toEqual([]);
        });
    });

    describe('Actions - Selection', () => {
        it('setProjects should set projects array', () => {
            const projects = [{ id: 'p-1', name: 'A' }, { id: 'p-2', name: 'B' }];
            store.setProjects(projects);

            expect(store.projects).toEqual(projects);
        });

        it('setSelectedProject should set project and clear selectedOrg', () => {
            store.selectedOrg = { id: 'org-1' };
            const project = { id: 'p-1', name: 'Test' };

            store.setSelectedProject(project);

            expect(store.selectedProject).toEqual(project);
            expect(store.selectedOrg).toBeNull();
        });

        it('setSelectedOrg should set the selected org', () => {
            const org = { id: 'org-1', name: 'My Org' };
            store.setSelectedOrg(org);

            expect(store.selectedOrg).toEqual(org);
        });
    });

    describe('Actions - Dialogs', () => {
        it('closeEditOrgDialog should set showEditOrgDialog to false', () => {
            store.showEditOrgDialog = true;
            store.closeEditOrgDialog();

            expect(store.showEditOrgDialog).toBe(false);
        });

        it('closeAddProjectDialog should set showAddProjectDialog to false', () => {
            store.showAddProjectDialog = true;
            store.closeAddProjectDialog();

            expect(store.showAddProjectDialog).toBe(false);
        });

        it('closeAddOrgDialog should set showAddOrgDialog to false', () => {
            store.showAddOrgDialog = true;
            store.closeAddOrgDialog();

            expect(store.showAddOrgDialog).toBe(false);
        });
    });

    describe('Actions - loadProjects', () => {
        it('should load projects and then load orgs', async () => {
            const mockProjects = [{ id: 'p-1', name: 'Project 1' }];
            const mockOrgs = [{ id: 'org-1', name: 'Org 1', projectId: 'p-1' }];

            axiosInstance.get
                .mockResolvedValueOnce({ data: { success: true, data: mockProjects } })
                .mockResolvedValueOnce({ data: { success: true, data: mockOrgs } });

            await store.loadProjects();

            expect(store.projects).toEqual(mockProjects);
            expect(store.orgs).toEqual(mockOrgs);
            expect(axiosInstance.get).toHaveBeenCalledTimes(2);
            expect(axiosInstance.get).toHaveBeenCalledWith('/', {
                headers: { action: 'get-projects' },
            });
        });

        it('should not load orgs if projects request fails', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            axiosInstance.get.mockResolvedValueOnce({
                data: { success: false, message: 'Unauthorized' },
            });

            await store.loadProjects();

            expect(store.projects).toEqual([]);
            expect(axiosInstance.get).toHaveBeenCalledTimes(1);
            consoleSpy.mockRestore();
        });
    });

    describe('Actions - loadOrgs', () => {
        it('should load orgs successfully', async () => {
            const mockOrgs = [
                { id: 'org-1', name: 'Source' },
                { id: 'org-2', name: 'Target' },
            ];
            axiosInstance.get.mockResolvedValueOnce({
                data: { success: true, data: mockOrgs },
            });

            const result = await store.loadOrgs();

            expect(result).toBe(true);
            expect(store.orgs).toEqual(mockOrgs);
            expect(axiosInstance.get).toHaveBeenCalledWith('/', {
                headers: { action: 'get-orgs' },
            });
        });

        it('should return false if loadOrgs fails', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            axiosInstance.get.mockResolvedValueOnce({
                data: { success: false, message: 'Error' },
            });

            const result = await store.loadOrgs();

            expect(result).toBe(false);
            consoleSpy.mockRestore();
        });
    });

    describe('Actions - deleteOrg', () => {
        it('should delete an org and remove it from state', async () => {
            store.orgs = [
                { id: 'org-1', name: 'A' },
                { id: 'org-2', name: 'B' },
            ];
            store.selectedOrg = { id: 'org-1', name: 'A' };

            axiosInstance.delete.mockResolvedValueOnce({
                data: { success: true },
            });

            const result = await store.deleteOrg('org-1');

            expect(result).toBe(true);
            expect(store.orgs).toHaveLength(1);
            expect(store.orgs[0].id).toBe('org-2');
            expect(store.selectedOrg).toBeNull();
        });

        it('should clear selectedOrg only if deleted org was selected', async () => {
            store.orgs = [
                { id: 'org-1', name: 'A' },
                { id: 'org-2', name: 'B' },
            ];
            store.selectedOrg = { id: 'org-2', name: 'B' };

            axiosInstance.delete.mockResolvedValueOnce({ data: { success: true } });

            await store.deleteOrg('org-1');

            expect(store.selectedOrg).toEqual({ id: 'org-2', name: 'B' });
        });

        it('should return false if delete fails', async () => {
            store.orgs = [{ id: 'org-1' }];
            axiosInstance.delete.mockResolvedValueOnce({ data: { success: false } });

            const result = await store.deleteOrg('org-1');

            expect(result).toBe(false);
            expect(store.orgs).toHaveLength(1);
        });

        it('should call API with correct headers', async () => {
            store.orgs = [{ id: 'org-1' }];
            axiosInstance.delete.mockResolvedValueOnce({ data: { success: true } });

            await store.deleteOrg('org-1');

            expect(axiosInstance.delete).toHaveBeenCalledWith('/', {
                headers: { action: 'delete-org', orgid: 'org-1' },
            });
        });
    });
});
