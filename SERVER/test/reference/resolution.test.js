import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Readable } from 'node:stream';
import { buildTargetMatchIndex, normalizeReferenceKey, validateReferenceResolution } from '../../src/utils/referenceResolution.js';

vi.mock('../../models/index.js', () => ({ default: { sequelize: { query: vi.fn() } } }));
vi.mock('../../src/services/mappingService.js', () => ({ default: { getFieldMappingsByOrgPair: vi.fn() } }));
vi.mock('fs/promises', () => ({ default: { mkdir: vi.fn(), writeFile: vi.fn() } }));
vi.mock('../../src/services/transformService.js', () => ({ default: { getStg2TableName: () => 'stg2_Contact' } }));
vi.mock('../../src/services/tracebackService.js', () => ({ default: { getUpsertConfig: vi.fn() } }));
vi.mock('../../src/services/bulkIngestService.js', () => ({ default: { buildConnection: vi.fn(), ingestRecords: vi.fn() } }));
vi.mock('../../src/services/extractionService.js', () => ({ default: { getStageTableName: vi.fn() } }));
vi.mock('../../src/services/migrationSettingService.js', () => ({
    default: { getReferenceResolutions: vi.fn(), getEffectiveSettingsMap: vi.fn() },
}));
vi.mock('../../src/repositories/recordIdMapRepository.js', () => ({ default: { findByObject: vi.fn(), setTargetIds: vi.fn() } }));

import db from '../../models/index.js';
import settings from '../../src/services/migrationSettingService.js';
import mappings from '../../src/services/mappingService.js';
import idMapRepo from '../../src/repositories/recordIdMapRepository.js';
import loadService, { getIdMap } from '../../src/services/loadService.js';
import tracebackService from '../../src/services/tracebackService.js';
import bulkIngestService from '../../src/services/bulkIngestService.js';
import extractionService from '../../src/services/extractionService.js';
import dependencyService from '../../src/services/dependencyService.js';
import { buildExtractionPlan } from '../../src/services/extractionPlanBuilder.js';

const resolution = { strategy: 'match-existing', sourceField: 'Username', targetField: 'Login__c', normalizer: 'localPartLowercase' };
const parent = {
    sourceObjectId: 'user-source', targetObjectId: 'user-target',
    sourceObject: { id: 'user-source', name: 'User' },
    targetObject: { id: 'user-target', name: 'ExistingUser__c' },
    metadata: { referenceResolution: resolution },
};

beforeEach(() => {
    vi.resetAllMocks();
    settings.getReferenceResolutions.mockResolvedValue([parent]);
    idMapRepo.findByObject.mockResolvedValue([]);
    extractionService.getStageTableName.mockReturnValue('stg1_User');
});

describe('reference keys', () => {
    test.each([
        ['Alice@source.test', 'none', 'Alice@source.test'],
        ['Alice@source.test', 'localPart', 'Alice'],
        ['Alice@source.test', 'lowercase', 'alice@source.test'],
        ['Alice@source.test', 'localPartLowercase', 'alice'],
        ['Alice', 'localPart', 'Alice'],
        [null, 'none', null], ['', 'none', null], ['@domain', 'localPart', null],
        [0, 'none', '0'], [false, 'none', 'false'],
    ])('normalizes %s with %s', (value, normalizer, expected) => {
        expect(normalizeReferenceKey(value, normalizer)).toBe(expected);
    });

    test('validates strategy, identifiers and normalizers', () => {
        expect(validateReferenceResolution({ strategy: 'id-map' })).toEqual({ strategy: 'id-map' });
        expect(() => validateReferenceResolution({ ...resolution, strategy: 'unknown' })).toThrow(/strategy/);
        expect(() => validateReferenceResolution({ ...resolution, normalizer: 'unknown' })).toThrow(/normalizer/);
        expect(() => validateReferenceResolution({ ...resolution, targetField: 'Id FROM User' })).toThrow(/API name/);
        expect(() => validateReferenceResolution({ ...resolution, sourceField: undefined })).toThrow(/API name/);
    });

    test('target index excludes null keys and invalidates all duplicates after normalization', async () => {
        const conn = { bulk2: { query: vi.fn().mockResolvedValue(Readable.from([
            { Id: '1', Login__c: 'Alice@one' }, { Id: '2', Login__c: 'alice@two' },
            { Id: '3', Login__c: 'ALICE@three' }, { Id: '4', Login__c: null },
            { Id: '5', Login__c: 'Bob@target' },
        ])) } };
        const index = await buildTargetMatchIndex(conn, 'ExistingUser__c', 'Login__c', 'localPartLowercase');
        expect([...index]).toEqual([['alice', null], ['bob', '5']]);
        expect(conn.bulk2.query).toHaveBeenCalledWith('SELECT Id, Login__c FROM ExistingUser__c');
        await expect(buildTargetMatchIndex(conn, 'User WHERE true', 'Name', 'none')).rejects.toThrow(/API name/);
        expect(conn.bulk2.query).toHaveBeenCalledTimes(1);
    });

    test('allows Id as a target match field without selecting it twice', async () => {
        const conn = { bulk2: { query: vi.fn().mockResolvedValue(Readable.from([{ Id: 'existing-id' }])) } };
        expect((await buildTargetMatchIndex(conn, 'User', 'Id', 'none')).get('existing-id')).toBe('existing-id');
        expect(conn.bulk2.query).toHaveBeenCalledWith('SELECT Id FROM User');
    });
});

describe('lookup ID resolution', () => {
    function context() {
        return {
            sourceOrgId: 'source', targetOrgId: 'target', idMaps: new Map(),
            conn: { bulk2: { query: vi.fn().mockImplementation(async () => Readable.from([
                { Id: 'target-bob', Login__c: 'Bob@target' },
                { Id: 'target-alice-1', Login__c: 'Alice@one' },
                { Id: 'target-alice-2', Login__c: 'alice@two' },
            ])) } },
        };
    }

    test('matches extracted parent keys, caches queries and rejects missing or ambiguous keys', async () => {
        db.sequelize.query.mockResolvedValueOnce([[{ exists: true }]]).mockResolvedValueOnce([[
            { Id: 'source-bob', __matchKey: 'BOB@source' },
            { Id: 'source-alice', __matchKey: 'alice@source' },
            { Id: 'source-missing', __matchKey: 'missing@source' },
            { Id: 'source-null', __matchKey: null },
        ]]);
        const ctx = context();
        const map = await getIdMap(ctx, 'User', ['source-bob', 'source-alice']);
        expect(map.get('source-bob')).toBe('target-bob');
        expect(map.get('source-alice')).toBeNull();
        expect(map.get('source-missing')).toBeNull();
        expect(map.get('source-null')).toBeNull();
        expect(map.get('not-extracted')).toBeUndefined();
        expect(await getIdMap(ctx, 'User', ['source-missing'])).toBe(map);
        expect(ctx.conn.bulk2.query).toHaveBeenCalledTimes(1);
        expect(db.sequelize.query).toHaveBeenCalledTimes(2);
        expect(db.sequelize.query).toHaveBeenLastCalledWith(
            expect.stringContaining('to_jsonb(parent) ->> $1'),
            { bind: ['Username'] },
        );
        expect(settings.getReferenceResolutions).toHaveBeenCalledTimes(1);
        expect(idMapRepo.findByObject).not.toHaveBeenCalled();
    });

    test('uses RecordIdMap by default and supports polymorphic OwnerId parents', async () => {
        settings.getReferenceResolutions.mockResolvedValue([]);
        idMapRepo.findByObject.mockImplementation(async ({ objectName }) => objectName === 'User'
            ? [{ sourceRecordId: 'source-user', targetRecordId: 'target-user' }] : []);
        const ctx = context();
        const map = await getIdMap(ctx, ['Group', 'User'], ['source-user']);
        expect(map.get('source-user')).toBe('target-user');
        expect(ctx.conn.bulk2.query).not.toHaveBeenCalled();
        expect(db.sequelize.query).not.toHaveBeenCalled();
    });

    test('does not fall back to stale RecordIdMap on a failed target query', async () => {
        const ctx = context();
        ctx.conn.bulk2.query.mockRejectedValue(new Error('query failed'));
        await expect(getIdMap(ctx, 'User', ['source-user'])).rejects.toThrow('query failed');
        expect(idMapRepo.findByObject).not.toHaveBeenCalled();
    });

    test('requires extracted parent data', async () => {
        db.sequelize.query.mockResolvedValue([[{ exists: false }]]);
        await expect(getIdMap(context(), 'User', ['source-user'])).rejects.toThrow(/Run extraction/);
    });

    test('rejects unsafe staging identifiers before issuing a database query', async () => {
        extractionService.getStageTableName.mockReturnValue('stg1_User"; DROP TABLE users; --');
        await expect(getIdMap(context(), 'User', ['source-user'])).rejects.toThrow(/Invalid reference staging table/);
        expect(db.sequelize.query).not.toHaveBeenCalled();
    });

    test('loads children with matched IDs, skips unresolved children and leaves null lookups alone', async () => {
        const ctx = context();
        bulkIngestService.buildConnection.mockResolvedValue(ctx.conn);
        tracebackService.getUpsertConfig.mockResolvedValue({ operation: 'insert' });
        bulkIngestService.ingestRecords.mockResolvedValue({
            successfulResults: [
                { sf__Id: 'contact-1', sf__Created: 'true' },
                { sf__Id: 'contact-4', sf__Created: 'true' },
            ],
            failedResults: [], unprocessedRecords: [],
        });
        const contact = {
            sourceObjectId: 'contact-source', targetObjectId: 'contact-target',
            sourceObject: { name: 'Contact' }, targetObject: { name: 'Contact' },
            mappingType: 'as-is',
            sourceField: { name: 'OwnerId', referenceTo: ['Group', 'User'] },
            targetField: { name: 'OwnerId' },
        };
        mappings.getFieldMappingsByOrgPair.mockResolvedValue([contact]);
        settings.getEffectiveSettingsMap.mockResolvedValue(new Map());
        db.sequelize.query.mockImplementation(async (sql) => {
            if (sql.includes('information_schema') || sql.includes('to_regclass')) return [[{ exists: true }]];
            if (sql.includes('AS runid')) return [[{ runid: 'transform-run' }]];
            if (sql.includes('SELECT * FROM "stg2_Contact"')) return [[
                { __srcId: 'c1', OwnerId: 'source-bob' },
                { __srcId: 'c2', OwnerId: 'source-alice' },
                { __srcId: 'c3', OwnerId: 'source-missing' },
                { __srcId: 'c4', OwnerId: null },
            ]];
            if (sql.includes('to_jsonb(parent)')) return [[
                { Id: 'source-bob', __matchKey: 'BOB@source' },
                { Id: 'source-alice', __matchKey: 'alice@source' },
                { Id: 'source-missing', __matchKey: 'missing@source' },
            ]];
            return [[]];
        });
        const result = await loadService.runLoad({ sourceOrgId: 'source', targetOrgId: 'target' });
        expect(bulkIngestService.ingestRecords).toHaveBeenCalledWith(expect.objectContaining({
            objectName: 'Contact', operation: 'insert',
            records: [{ OwnerId: 'target-bob' }, { OwnerId: null }],
        }));
        expect(result.results[0]).toMatchObject({ ready: 2, loaded: 2, skipped: 2, status: 'success' });
        expect(ctx.conn.bulk2.query).toHaveBeenCalledTimes(1);
    });
});

describe('planning', () => {
    test('extracts a match field for a parent without any field mappings', async () => {
        const contact = { id: 'contact-source', name: 'Contact' };
        const metadataRepo = {
            findObjectsByOrgId: vi.fn().mockResolvedValue([contact, parent.sourceObject]),
            findFieldsByObjectId: vi.fn().mockResolvedValue([]),
        };
        const plan = await buildExtractionPlan({
            sourceOrgId: 'source', metadataRepo, referenceResolutions: [parent],
            fieldMappings: [{ sourceObject: contact, sourceField: { name: 'OwnerId' } }],
        });
        expect(plan.objects.map((object) => object.name)).toEqual(['Contact', 'User']);
        expect([...plan.fieldsByObjectId.get('user-source')]).toEqual(['Id', 'Username']);
        expect([...plan.fieldsByObjectId.get('contact-source')]).toEqual(['Id', 'OwnerId']);
    });

    test('does not load match-existing Accounts when migrating Contact.AccountId', async () => {
        const account = {
            sourceObjectId: 'account-source', targetObjectId: 'account-target',
            sourceObject: { name: 'Account' }, targetObject: { name: 'Account' },
        };
        const contact = {
            sourceObjectId: 'contact-source', targetObjectId: 'contact-target',
            sourceObject: { name: 'Contact' }, targetObject: { name: 'Contact' },
            mappingType: 'as-is', sourceField: { name: 'AccountId', type: 'reference', referenceTo: ['Account'] },
        };
        mappings.getFieldMappingsByOrgPair.mockResolvedValue([account, contact]);
        settings.getEffectiveSettingsMap.mockResolvedValue(new Map([
            ['account-source', new Map([['account-target', { referenceResolution: resolution }]])],
        ]));
        const plan = await dependencyService.getLoadPlan('source', 'target');
        expect(plan.loadOrder.map((node) => node.sourceObjectName)).toEqual(['Contact']);
        expect(plan.deferredFields).toEqual([]);
        settings.getEffectiveSettingsMap.mockResolvedValue(new Map());
        expect((await dependencyService.getLoadPlan('source', 'target')).loadOrder.map((node) => node.sourceObjectName))
            .toEqual(['Account', 'Contact']);
    });
});
