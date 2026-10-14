/**
 * uiCapabilities.test.js — reconciles what the UI advertises with what the engine
 * actually does.
 *
 *  1. BUILDER PATH: every node kind + function the visual builder exposes
 *     (TransformNodeEditor.vue kindOptions / functionNames) is sent to the backend
 *     as a transform tree and must validate + evaluate. These should PASS; a
 *     failure means the engine itself is broken for a builder-reachable feature.
 *
 *  2. FORMULA PATH: the formula textarea placeholder (FieldMapping.vue /
 *     MigrationWorkspace.vue) tells users to write
 *       {Object.Field}, {Object.Field1 || Object.Field2}, {SUBSTR(Object.Field, 2, 5)}
 *     but the formula box is parsed by parseExpressionToTree, whose braces wrap a
 *     SINGLE field only. The last two examples therefore throw. Those cases assert
 *     the INTENDED behavior and are EXPECTED TO FAIL until the placeholder or the
 *     parser is fixed — they are the bug inventory for the UI symptom.
 */

import { describe, test, expect } from 'vitest';
import { parseExpressionToTree } from '../../src/utils/expressionParser.js';
import { evaluateTransform } from '../../src/utils/transformTree.js';
import {
    PERSON, f, c, concat, fn, cmp, iff, coalesce, valueMap, binop, evalCases,
} from '../helpers/records.js';

describe('builder path: every exposed node kind validates + evaluates', () => {
    evalCases([
        { name: 'field', tree: f('FirstName'), record: PERSON, expected: 'John' },
        { name: 'const', tree: c('X'), record: PERSON, expected: 'X' },
        { name: 'concat', tree: concat(f('FirstName'), c(' '), f('LastName')), record: PERSON, expected: 'John Doe' },
        { name: 'func', tree: fn('UPPER', f('FirstName')), record: PERSON, expected: 'JOHN' },
        { name: 'if', tree: iff(cmp('=', f('LastName'), c('')), f('FirstName'), concat(f('FirstName'), c(' '), f('LastName'))), record: PERSON, expected: 'John Doe' },
        { name: 'compare', tree: cmp('>', f('Age'), c(18)), record: PERSON, expected: true },
        { name: 'binop', tree: binop('+', f('Amount'), c(1)), record: PERSON, expected: 1001 },
        { name: 'coalesce', tree: coalesce(f('MiddleName'), f('FirstName')), record: PERSON, expected: 'John' },
        { name: 'valueMap', tree: valueMap(f('Status'), { A: 'Active' }, c('?')), record: PERSON, expected: 'Active' },
    ]);
});

describe('builder path: every exposed function evaluates', () => {
    evalCases([
        { name: 'SUBSTR', tree: fn('SUBSTR', f('FirstName'), c(1), c(2)), record: PERSON, expected: 'Jo' },
        { name: 'LEN', tree: fn('LEN', f('FirstName')), record: PERSON, expected: 4 },
        { name: 'UPPER', tree: fn('UPPER', f('FirstName')), record: PERSON, expected: 'JOHN' },
        { name: 'LOWER', tree: fn('LOWER', f('Email')), record: PERSON, expected: 'john@example.com' },
        { name: 'TRIM', tree: fn('TRIM', f('City')), record: PERSON, expected: 'Berlin' },
        { name: 'DATE', tree: fn('DATE', f('Created')), record: PERSON, expected: '2024-03-15' },
        { name: 'DATETIME', tree: fn('DATETIME', f('Created')), record: PERSON, expected: '2024-03-15T10:30:00Z' },
        { name: 'ADDDAYS', tree: fn('ADDDAYS', f('Created'), c(5)), record: PERSON, expected: '2024-03-20' },
        { name: 'ADDHOURS', tree: fn('ADDHOURS', f('Created'), c(2)), record: PERSON, expected: '2024-03-15T12:30:00Z' },
    ]);
});

describe('formula path: placeholder example that works', () => {
    test('{Object.Field} single braced field', () => {
        expect(evaluateTransform(parseExpressionToTree('{Account.Name}'), { Name: 'Acme' })).toBe('Acme');
    });
});

// Documents the UI/parser mismatch: the formula placeholder tells users to type
// these, but the new parser rejects them (braces wrap exactly ONE field). test.fails
// asserts they currently throw; it will FLIP to failing once reconciled, as a
// reminder to update the placeholder or widen the grammar, then drop test.fails.
describe('known gap: formula placeholder examples the parser rejects', () => {
    test.fails('{Object.Field1 || Object.Field2} should concat', () => {
        const value = evaluateTransform(parseExpressionToTree('{Account.First || Account.Last}'), { First: 'A', Last: 'B' });
        expect(value).toBe('AB');
    });
    test.fails('{SUBSTR(Object.Field, 2, 5)} should substring', () => {
        const value = evaluateTransform(parseExpressionToTree('{SUBSTR(Account.Name, 2, 5)}'), { Name: 'Hello World' });
        expect(value).toBe('ello');
    });
});
