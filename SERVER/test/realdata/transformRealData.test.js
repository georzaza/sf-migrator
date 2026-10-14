/**
 * transformRealData.test.js — Phase 2 real-data harness (opt-in).
 *
 * Runs the SAME engine the pipeline uses against your actual extracted stg1_*
 * tables, so you verify transformations against data you recognize. It is
 * READ-ONLY (SELECT ... LIMIT) and never writes stg2 or calls Salesforce.
 *
 * Enable it explicitly (it is excluded from `npm test`):
 *   cross-env TEST_DB=1 SOURCE_ORG_ID=<uuid> TARGET_ORG_ID=<uuid> npm run test:realdata
 * (test:realdata already sets TEST_DB=1; provide the two org ids.)
 *
 * What it checks today:
 *   1. Every stored field mapping for the org pair folds to a tree and validates.
 *   2. Each mapping evaluates + serializes over a sample of real driving rows
 *      without throwing, yielding string | null.
 *
 * Extend later with "golden records": freeze a few (srcId, targetField) -> value
 * expectations and assert them here to catch regressions.
 */

import { describe, test, expect } from 'vitest';

import orgRepo from '../../src/repositories/orgRepository.js';


const DB_ENABLED = process.env.TEST_DB === '1';
// const SOURCE = process.env.SOURCE_ORG_ID;
// const TARGET = process.env.TARGET_ORG_ID;
const SOURCE = '00000000-0000-4000-8000-000000000100';
const TARGET = '00000000-0000-4000-8000-000000000000';
const SAMPLE_LIMIT = Number(process.env.SAMPLE_LIMIT || 20);

const skipReason = !DB_ENABLED
    ? 'set TEST_DB=1 to enable real-data tests'
    : (!SOURCE || !TARGET)
        ? 'set SOURCE_ORG_ID and TARGET_ORG_ID env vars'
        : null;

// Only pull in the model/service graph when actually running against the DB.
let db = null;
let mappingService = null;
let extractionService = null;
let transformTree = null;
let parseExpressionToTree = null;
let QueryTypes = null;
if (!skipReason) {
    db = (await import('../../models/index.js')).default;
    mappingService = (await import('../../src/services/mappingService.js')).default;
    extractionService = (await import('../../src/services/extractionService.js')).default;
    transformTree = await import('../../src/utils/transformTree.js');
    ({ parseExpressionToTree } = await import('../../src/utils/expressionParser.js'));
    ({ QueryTypes } = await import('sequelize'));
}

async function tableExists(name) {
    const rows = await db.sequelize.query(
        'SELECT 1 FROM information_schema.tables WHERE table_name = :name LIMIT 1',
        { replacements: { name }, type: QueryTypes.SELECT },
    );
    return rows.length > 0;
}

describe.skipIf(Boolean(skipReason))('real-data transform smoke', () => {
    test('orgs exist', async () => {
        // get the orgs from the orgRepository
        const sourceOrg = await orgRepo.findById(SOURCE);
        const targetOrg = await orgRepo.findById(TARGET);
        expect(sourceOrg, 'source org not found').toBeTruthy();
        expect(targetOrg, 'target org not found').toBeTruthy();
    });
});

describe.skipIf(Boolean(skipReason))('real-data transform smoke', () => {
    test('every stored mapping folds + validates', async () => {
        const mappings = await mappingService.getFieldMappingsByOrgPair(SOURCE, TARGET);
        expect(mappings.length, 'no field mappings found for this org pair').toBeGreaterThan(0);

        const failures = [];
        for (const m of mappings) {
            const label = `${m.sourceObject?.name}.${m.sourceField?.name ?? m.mappingType} -> ${m.targetObject?.name}.${m.targetField?.name}`;
            try {
                const tree = transformTree.mappingToTree(m);
                transformTree.validateTransform(tree);
            } catch (err) {
                failures.push(`${label}: ${err.message}`);
            }
        }
        expect(failures, `invalid stored mappings:\n${failures.join('\n')}`).toEqual([]);
    });

    test('mappings evaluate + serialize over sample stg1 rows', async () => {
        const mappings = await mappingService.getFieldMappingsByOrgPair(SOURCE, TARGET);

        // Group mappings by their driving (source) object.
        const byDriving = new Map();
        for (const m of mappings) {
            const name = m.sourceObject?.name;
            if (!name) continue;
            if (!byDriving.has(name)) byDriving.set(name, []);
            byDriving.get(name).push(m);
        }

        const failures = [];
        let rowsChecked = 0;

        for (const [objectName, objectMappings] of byDriving) {
            const tableName = extractionService.getStageTableName(SOURCE, objectName);
            if (!(await tableExists(tableName))) continue; // not extracted yet

            const rows = await db.sequelize.query(
                `SELECT * FROM "${tableName}" LIMIT :limit`,
                { replacements: { limit: SAMPLE_LIMIT }, type: QueryTypes.SELECT },
            );

            for (const row of rows) {
                rowsChecked += 1;
                for (const m of objectMappings) {
                    const target = `${objectName} -> ${m.targetObject?.name}.${m.targetField?.name}`;
                    try {
                        const tree = transformTree.mappingToTree(m);
                        const value = transformTree.toCellValue(transformTree.evaluateTransform(tree, row));
                        if (!(value === null || typeof value === 'string')) {
                            failures.push(`${target}: serialized to ${typeof value}`);
                        }
                    } catch (err) {
                        failures.push(`${target} [srcId=${row.Id ?? row.id}]: ${err.message}`);
                    }
                }
            }
        }

        expect(failures, `evaluation failures over ${rowsChecked} rows:\n${failures.slice(0, 50).join('\n')}`).toEqual([]);
    });
});

/* ---------------------------------------------------------------------------
 * Formula battery against real stg1_* Account rows.
 *
 * Pulls actual extracted Account rows and runs a wide variety of formula
 * transforms (concat, string funcs, arithmetic, comparison, IF, COALESCE, and
 * deep combinations) through the SAME parser + evaluator the pipeline uses.
 * Each formula's engine output is checked against an INDEPENDENT reference
 * oracle computed directly from the row, so this validates correctness — not
 * just "does not throw".
 * ------------------------------------------------------------------------- */

// Reference helpers mirroring transformTree.js value semantics.
const S = (v) => (v === null || v === undefined ? '' : String(v));
const N = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
};
const NIL = (v) => v === null || v === undefined || v === '';
const SUB = (v, start, end) => {
    const s = S(v);
    const st = Math.max(start - 1, 0);
    const len = Math.max(end - (st + 1) + 1, 0);
    return s.substring(st, st + len);
};
const CMP = (op, l, r) => {
    const ln = N(l);
    const rn = N(r);
    const numeric = ln !== null && rn !== null;
    const a = numeric ? ln : S(l);
    const b = numeric ? rn : S(r);
    switch (op) {
        case '=': return a === b;
        case '!=': return a !== b;
        case '<': return a < b;
        case '<=': return a <= b;
        case '>': return a > b;
        case '>=': return a >= b;
        default: return false;
    }
};
const COAL = (...xs) => { for (const x of xs) { if (!NIL(x)) return x; } return null; };
// Serialize to the stg2 TEXT form (toCellValue): null stays null, else String().
const CELL = (v) => (v === undefined || v === null ? null : String(v));

/**
 * Cases: formula string + independent oracle computing the native expected
 * value from a flat Account row (columns Name, BillingCity, AccountNumber,
 * NumberOfEmployees, Description).
 */
const CASES = [
    // --- string functions ---
    { f: 'UPPER({Account.Name})', exp: (r) => S(r.Name).toUpperCase() },
    { f: 'LOWER({Account.BillingCity})', exp: (r) => S(r.BillingCity).toLowerCase() },
    { f: 'TRIM({Account.Name})', exp: (r) => S(r.Name).trim() },
    { f: 'LEN({Account.Name})', exp: (r) => S(r.Name).length },
    { f: 'SUBSTR({Account.Name}, 1, 10)', exp: (r) => SUB(r.Name, 1, 10) },
    { f: "LEN({Account.Name}) || ' chars'", exp: (r) => S(S(r.Name).length) + ' chars' },

    // --- concat + const ---
    { f: "{Account.BillingCity} || '_' || {Account.Name}", exp: (r) => S(r.BillingCity) + '_' + S(r.Name) },
    {
        f: "{Account.AccountNumber} || '-' || {Account.Name} || '-' || {Account.BillingCity}",
        exp: (r) => S(r.AccountNumber) + '-' + S(r.Name) + '-' + S(r.BillingCity),
    },
    { f: "'ACC_' || {Account.AccountNumber} || '_' || {Account.BillingCity}", exp: (r) => 'ACC_' + S(r.AccountNumber) + '_' + S(r.BillingCity) },
    {
        f: "UPPER(SUBSTR({Account.BillingCity}, 1, 3)) || '-' || {Account.AccountNumber}",
        exp: (r) => SUB(r.BillingCity, 1, 3).toUpperCase() + '-' + S(r.AccountNumber),
    },
    { f: 'UPPER(TRIM(SUBSTR({Account.Description}, 1, 20)))', exp: (r) => SUB(r.Description, 1, 20).trim().toUpperCase() },

    // --- arithmetic ---
    { f: '{Account.NumberOfEmployees} + 1', exp: (r) => (N(r.NumberOfEmployees) === null ? null : N(r.NumberOfEmployees) + 1) },
    { f: '{Account.NumberOfEmployees} * 2', exp: (r) => (N(r.NumberOfEmployees) === null ? null : N(r.NumberOfEmployees) * 2) },
    { f: '{Account.NumberOfEmployees} / 10', exp: (r) => (N(r.NumberOfEmployees) === null ? null : N(r.NumberOfEmployees) / 10) },
    { f: '{Account.NumberOfEmployees} - 5', exp: (r) => (N(r.NumberOfEmployees) === null ? null : N(r.NumberOfEmployees) - 5) },
    { f: 'LEN({Account.Name}) + LEN({Account.BillingCity})', exp: (r) => S(r.Name).length + S(r.BillingCity).length },
    {
        f: '({Account.NumberOfEmployees} + 10) * 2',
        exp: (r) => (N(r.NumberOfEmployees) === null ? null : (N(r.NumberOfEmployees) + 10) * 2),
    },

    // --- comparison ---
    { f: '{Account.NumberOfEmployees} > 100', exp: (r) => CMP('>', r.NumberOfEmployees, 100) },
    { f: 'LEN({Account.Name}) >= 10', exp: (r) => CMP('>=', S(r.Name).length, 10) },
    { f: "{Account.AccountNumber} != ''", exp: (r) => CMP('!=', r.AccountNumber, '') },
    { f: 'LEN({Account.AccountNumber}) > 8', exp: (r) => CMP('>', S(r.AccountNumber).length, 8) },

    // --- IF / else (incl. nested) ---
    {
        f: "IF(LEN({Account.AccountNumber}) > 8, 'NULL', {Account.BillingCity} || '_' || {Account.Name})",
        exp: (r) => (CMP('>', S(r.AccountNumber).length, 8) ? 'NULL' : S(r.BillingCity) + '_' + S(r.Name)),
    },
    {
        f: "IF({Account.NumberOfEmployees} > 1000, 'Enterprise', IF({Account.NumberOfEmployees} > 100, 'Mid-Market', 'SMB'))",
        exp: (r) => (CMP('>', r.NumberOfEmployees, 1000) ? 'Enterprise' : (CMP('>', r.NumberOfEmployees, 100) ? 'Mid-Market' : 'SMB')),
    },
    {
        f: "IF({Account.BillingCity} = 'Athens', UPPER({Account.Name}), LOWER({Account.Name}))",
        exp: (r) => (CMP('=', r.BillingCity, 'Athens') ? S(r.Name).toUpperCase() : S(r.Name).toLowerCase()),
    },
    {
        f: "IF(LEN({Account.BillingCity}) > 0, {Account.BillingCity} || '_' || {Account.Name}, {Account.Name})",
        exp: (r) => (CMP('>', S(r.BillingCity).length, 0) ? S(r.BillingCity) + '_' + S(r.Name) : r.Name),
    },
    {
        f: "IF(LEN({Account.Description}) > 100, SUBSTR({Account.Description}, 1, 100) || '...', {Account.Description})",
        exp: (r) => (CMP('>', S(r.Description).length, 100) ? SUB(r.Description, 1, 100) + '...' : r.Description),
    },

    // --- COALESCE ---
    { f: "COALESCE({Account.BillingCity}, 'Unknown')", exp: (r) => COAL(r.BillingCity, 'Unknown') },
    { f: "COALESCE({Account.Description}, {Account.Name}, 'N/A')", exp: (r) => COAL(r.Description, r.Name, 'N/A') },
    {
        f: "COALESCE({Account.BillingCity}, {Account.Name}) || '_' || {Account.AccountNumber}",
        exp: (r) => S(COAL(r.BillingCity, r.Name)) + '_' + S(r.AccountNumber),
    },
    {
        f: "IF(LEN(COALESCE({Account.BillingCity}, '')) = 0, 'NO_CITY', {Account.BillingCity})",
        exp: (r) => (CMP('=', S(COAL(r.BillingCity, '')).length, 0) ? 'NO_CITY' : r.BillingCity),
    },

    // --- deep combinations of everything ---
    {
        f: "IF({Account.NumberOfEmployees} > 500, UPPER({Account.Name}) || '_' || COALESCE({Account.BillingCity}, 'HQ'), LOWER(SUBSTR({Account.Name}, 1, 5)))",
        exp: (r) => (CMP('>', r.NumberOfEmployees, 500)
            ? S(r.Name).toUpperCase() + '_' + S(COAL(r.BillingCity, 'HQ'))
            : SUB(r.Name, 1, 5).toLowerCase()),
    },
    {
        f: "COALESCE({Account.BillingCity}, 'City') || '-' || SUBSTR(UPPER(TRIM({Account.Name})), 1, 8) || '-' || ({Account.NumberOfEmployees} * 2)",
        exp: (r) => {
            const e = N(r.NumberOfEmployees);
            const e2 = e === null ? null : e * 2;
            return S(COAL(r.BillingCity, 'City')) + '-' + SUB(S(r.Name).trim().toUpperCase(), 1, 8) + '-' + S(e2);
        },
    },
    {
        f: "IF(LEN({Account.Description}) > LEN({Account.Name}), 'DESC_LONGER', 'NAME_LONGER')",
        exp: (r) => (CMP('>', S(r.Description).length, S(r.Name).length) ? 'DESC_LONGER' : 'NAME_LONGER'),
    },
];

describe.skipIf(Boolean(skipReason))('real-data Account formula battery', () => {
    test('every formula matches its oracle on real stg1 Account rows', async () => {
        const tableName = extractionService.getStageTableName(SOURCE, 'Account');
        const exists = await tableExists(tableName);
        expect(exists, `stg1 Account table "${tableName}" not found — extract Account first`).toBe(true);

        const rows = await db.sequelize.query(
            `SELECT * FROM "${tableName}" LIMIT :limit`,
            { replacements: { limit: SAMPLE_LIMIT }, type: QueryTypes.SELECT },
        );
        expect(rows.length, 'no Account rows extracted for this org').toBeGreaterThan(0);

        // Compile each formula once; parse errors surface immediately.
        const compiled = CASES.map((c) => ({ ...c, tree: parseExpressionToTree(c.f) }));

        const failures = [];
        let checks = 0;
        for (const row of rows) {
            for (const c of compiled) {
                checks += 1;
                let actual;
                try {
                    actual = transformTree.toCellValue(transformTree.evaluateTransform(c.tree, row));
                } catch (err) {
                    failures.push(`[${c.f}] srcId=${row.Id ?? row.id}: threw ${err.message}`);
                    continue;
                }
                const expected = CELL(c.exp(row));
                if (actual !== expected) {
                    failures.push(`[${c.f}] srcId=${row.Id ?? row.id}: got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`);
                }
            }
        }

        expect(
            failures,
            `${failures.length}/${checks} formula checks mismatched:\n${failures.slice(0, 50).join('\n')}`,
        ).toEqual([]);
    });
});
