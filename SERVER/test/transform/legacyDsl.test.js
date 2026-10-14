/**
 * legacyDsl.test.js — the LEGACY parser/evaluator (transformationRule.js) plus the
 * astToTree / dslToTree / treeToDsl bridge. The legacy grammar is intentionally
 * narrow: `{...}` wrapper required, dotted field refs only, `||`, string literals,
 * SUBSTR. treeToDsl can only print that subset and must throw for richer nodes.
 */

import { describe, test, expect } from 'vitest';
import {
    parseTransformationRule,
    evaluateTransformationRule,
    extractReferencedFields,
} from '../../src/utils/transformationRule.js';
import { astToTree, dslToTree, treeToDsl } from '../../src/utils/transformTree.js';

describe('legacy parseTransformationRule', () => {
    test('single dotted field ref', () => expect(parseTransformationRule('{Account.Name}')).toEqual(
        { type: 'fieldRef', value: 'Account.Name' },
    ));
    test('concat of two fields', () => expect(parseTransformationRule('{Account.First || Account.Last}')).toEqual(
        { type: 'concat', parts: [{ type: 'fieldRef', value: 'Account.First' }, { type: 'fieldRef', value: 'Account.Last' }] },
    ));
    test('concat with string literal', () => expect(parseTransformationRule("{Account.Name || '-'}")).toEqual(
        { type: 'concat', parts: [{ type: 'fieldRef', value: 'Account.Name' }, { type: 'literal', value: '-' }] },
    ));
    test('SUBSTR', () => expect(parseTransformationRule('{SUBSTR(Account.Name, 2, 5)}')).toEqual(
        { type: 'substr', value: { type: 'fieldRef', value: 'Account.Name' }, start: 2, end: 5 },
    ));
});

describe('legacy evaluateTransformationRule', () => {
    test('field read (root segment skipped)', () => expect(
        evaluateTransformationRule('{Account.Name}', { Name: 'Acme' })).toBe('Acme'));
    test('concat with literal separator', () => expect(
        evaluateTransformationRule("{Account.First || '-' || Account.Last}", { First: 'A', Last: 'B' })).toBe('A-B'));
    test('SUBSTR 2..4', () => expect(
        evaluateTransformationRule('{SUBSTR(Account.Name, 2, 4)}', { Name: 'Hello' })).toBe('ell'));
});

describe('legacy grammar limitations (throw)', () => {
    test('missing braces', () => expect(() => parseTransformationRule('Account.Name')).toThrow(/start with/));
    test('empty braces', () => expect(() => parseTransformationRule('{}')).toThrow(/cannot be empty/));
    test('bare non-dotted field is not tokenizable', () => expect(() => parseTransformationRule('{Name}')).toThrow());
    test('trailing tokens', () => expect(() => parseTransformationRule('{Account.Name Account.Other}')).toThrow());
});

describe('extractReferencedFields', () => {
    test('from concat', () => expect(
        [...extractReferencedFields(parseTransformationRule('{Account.First || Account.Last}'))].sort()).toEqual(
        ['Account.First', 'Account.Last'],
    ));
    test('from substr', () => expect(
        [...extractReferencedFields(parseTransformationRule('{SUBSTR(Account.Name, 1, 3)}'))].sort()).toEqual(
        ['Account.Name'],
    ));
});

describe('astToTree / dslToTree bridge', () => {
    test('fieldRef -> field', () => expect(astToTree({ type: 'fieldRef', value: 'A.B' })).toEqual({ kind: 'field', path: 'A.B' }));
    test('literal -> const', () => expect(astToTree({ type: 'literal', value: 'x' })).toEqual({ kind: 'const', value: 'x' }));
    test('substr -> func', () => expect(astToTree({ type: 'substr', value: { type: 'fieldRef', value: 'A.B' }, start: 2, end: 5 })).toEqual(
        { kind: 'func', name: 'SUBSTR', args: [{ kind: 'field', path: 'A.B' }, { kind: 'const', value: 2 }, { kind: 'const', value: 5 }] },
    ));
    test('unknown ast type throws', () => expect(() => astToTree({ type: 'mystery' })).toThrow());
    test('dslToTree end-to-end', () => expect(dslToTree('{Account.Name || "-"}')).toEqual(
        { kind: 'concat', parts: [{ kind: 'field', path: 'Account.Name' }, { kind: 'const', value: '-' }] },
    ));
});

describe('treeToDsl printer', () => {
    test('field', () => expect(treeToDsl({ kind: 'field', path: 'A.B' })).toBe('{A.B}'));
    test('string const quoted', () => expect(treeToDsl({ kind: 'const', value: 'x' })).toBe("{'x'}"));
    test('number const bare', () => expect(treeToDsl({ kind: 'const', value: 5 })).toBe('{5}'));
    test('concat', () => expect(
        treeToDsl({ kind: 'concat', parts: [{ kind: 'field', path: 'A.B' }, { kind: 'const', value: '-' }] })).toBe(
        "{A.B || '-'}",
    ));
    test('SUBSTR', () => expect(
        treeToDsl({ kind: 'func', name: 'SUBSTR', args: [{ kind: 'field', path: 'A.B' }, { kind: 'const', value: 2 }, { kind: 'const', value: 5 }] })).toBe(
        '{SUBSTR(A.B, 2, 5)}',
    ));
    test('rich nodes are not representable (if)', () => expect(
        () => treeToDsl({ kind: 'if', cond: { kind: 'const', value: true }, then: { kind: 'const', value: 'a' }, else: { kind: 'const', value: 'b' } })).toThrow(/not representable/));
    test('non-SUBSTR function not representable', () => expect(
        () => treeToDsl({ kind: 'func', name: 'UPPER', args: [{ kind: 'field', path: 'A.B' }] })).toThrow(/not representable/));
});
