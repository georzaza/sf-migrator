import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('../../src/repositories/migrationSettingRepository.js', () => ({
    default: { findByObjectPair: vi.fn(), findAllByOrgPair: vi.fn(), upsert: vi.fn() },
}));
vi.mock('../../src/repositories/metadataRepository.js', () => ({
    default: { findObjectById: vi.fn(), findFieldsByObjectId: vi.fn() },
}));
vi.mock('../../src/repositories/mappingRepository.js', () => ({ default: {} }));

import repo from '../../src/repositories/migrationSettingRepository.js';
import metadata from '../../src/repositories/metadataRepository.js';
import service from '../../src/services/migrationSettingService.js';
import traceback from '../../src/services/tracebackService.js';

const config = { strategy: 'match-existing', sourceField: 'Username', targetField: 'Login__c', normalizer: 'localPart' };

beforeEach(() => {
    vi.resetAllMocks();
    metadata.findObjectById.mockImplementation(async (id) => ({ id }));
    metadata.findFieldsByObjectId.mockImplementation(async (id) => [{ name: id === 'source' ? 'Username' : 'Login__c' }]);
    repo.findByObjectPair.mockResolvedValue({ metadata: { upsertExternalId: { id: 'external', name: 'Key__c' } } });
});

test('settings endpoint validates and saves resolution without losing upsert metadata', async () => {
    await service.upsertSetting('source', 'target', { batchSize: 200, referenceResolution: config });
    expect(repo.upsert).toHaveBeenCalledWith('source', 'target', {
        batchSize: 200,
        metadata: { upsertExternalId: { id: 'external', name: 'Key__c' }, referenceResolution: config },
    });
});

test('traceback setter can restore default ID-map resolution while preserving metadata', async () => {
    await traceback.setReferenceResolution('source', 'target', { strategy: 'id-map' });
    expect(repo.upsert).toHaveBeenCalledWith('source', 'target', {
        metadata: {
            upsertExternalId: { id: 'external', name: 'Key__c' },
            referenceResolution: { strategy: 'id-map' },
        },
    });
});

test('rejects fields from the wrong object, including the metadata input path', async () => {
    await expect(service.upsertSetting('source', 'target', {
        metadata: { referenceResolution: { ...config, targetField: 'Username' } },
    })).rejects.toThrow(/does not belong/);
    expect(repo.upsert).not.toHaveBeenCalled();
});

test('rejects malformed configuration before persisting', async () => {
    for (const referenceResolution of [null, {}, { ...config, sourceField: 'Name FROM User' }]) {
        await expect(service.upsertSetting('source', 'target', { referenceResolution })).rejects.toThrow();
    }
    expect(repo.upsert).not.toHaveBeenCalled();
});

test('returns effective strategies and discovers settings without parent mappings', async () => {
    const rows = [
        { sourceObjectId: 's1', targetObjectId: 't1', metadata: { referenceResolution: config } },
        { sourceObjectId: 's2', targetObjectId: 't2', metadata: null },
    ];
    repo.findAllByOrgPair.mockResolvedValue(rows);
    const map = await service.getEffectiveSettingsMap('source', 'target');
    expect(map.get('s1').get('t1').referenceResolution).toEqual(config);
    expect(map.get('s2').get('t2').referenceResolution).toEqual({ strategy: 'id-map' });
    expect(await service.getReferenceResolutions('source', 'target')).toEqual([rows[0]]);
});
