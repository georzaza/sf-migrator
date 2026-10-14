/**
 * parserReconciliation.test.js — the two DSL parsers side by side. Documents
 * where they agree, where the legacy parser rejects what the new one accepts,
 * and the treeToDsl round-trip (which is consumable by the LEGACY parser only —
 * a footgun, since the formula box uses the NEW parser).
 */

import { describe, test, expect } from 'vitest';
import { parseExpressionToTree } from '../../src/utils/expressionParser.js';
import { dslToTree, treeToDsl, evaluateTransform } from '../../src/utils/transformTree.js';
import { evaluateTransformationRule } from '../../src/utils/transformationRule.js';

describe('both parsers agree on the shared subset', () => {
    test('concat with literal', () => expect(parseExpressionToTree("Account.Name || '-'")).toEqual(
        dslToTree("{Account.Name || '-'}"),
    ));
    test('SUBSTR', () => expect(parseExpressionToTree('SUBSTR(Account.Name, 2, 5)')).toEqual(
        dslToTree('{SUBSTR(Account.Name, 2, 5)}'),
    ));
    test('dotted field ref', () => expect(parseExpressionToTree('Account.Owner.Name')).toEqual(
        dslToTree('{Account.Owner.Name}'),
    ));
});

describe('new parser supports what the legacy parser rejects', () => {
    test('bare single field', () => {
        expect(parseExpressionToTree('Name')).toEqual({ kind: 'field', path: 'Name' });
        expect(() => dslToTree('{Name}')).toThrow();
    });
    test('IF', () => {
        expect(parseExpressionToTree("IF(A.B = '', A.C, A.D)").kind).toBe('if');
        expect(() => dslToTree("{IF(A.B = '', A.C, A.D)}")).toThrow();
    });
    test('COALESCE', () => {
        expect(parseExpressionToTree('COALESCE(A.B, A.C)').kind).toBe('coalesce');
        expect(() => dslToTree('{COALESCE(A.B, A.C)}')).toThrow();
    });
    test('arithmetic', () => {
        expect(parseExpressionToTree('2 + 3').kind).toBe('binop');
        expect(() => dslToTree('{2 + 3}')).toThrow();
    });
    test('comparison', () => {
        expect(parseExpressionToTree('A.B = A.C').kind).toBe('compare');
        expect(() => dslToTree('{A.B = A.C}')).toThrow();
    });
});

describe('treeToDsl round-trips through the LEGACY parser only', () => {
    const roundTrip = (tree) => dslToTree(treeToDsl(tree));

    test('field', () => {
        const tree = { kind: 'field', path: 'A.B' };
        expect(roundTrip(tree)).toEqual(tree);
    });
    test('concat', () => {
        const tree = { kind: 'concat', parts: [{ kind: 'field', path: 'A.B' }, { kind: 'const', value: '-' }] };
        expect(roundTrip(tree)).toEqual(tree);
    });
    test('SUBSTR', () => {
        const tree = { kind: 'func', name: 'SUBSTR', args: [{ kind: 'field', path: 'A.B' }, { kind: 'const', value: 2 }, { kind: 'const', value: 5 }] };
        expect(roundTrip(tree)).toEqual(tree);
    });
    test('treeToDsl output is REJECTED by the new parser (dialect mismatch)', () => {
        const tree = { kind: 'concat', parts: [{ kind: 'field', path: 'A.B' }, { kind: 'const', value: '-' }] };
        const dsl = treeToDsl(tree); // "{A.B || '-'}"
        expect(() => parseExpressionToTree(dsl)).toThrow();
    });
});

describe('SUBSTR evaluates identically in both engines', () => {
    test('new engine', () => expect(evaluateTransform(parseExpressionToTree("SUBSTR('Hello', 2, 4)"), {})).toBe('ell'));
    test('legacy engine', () => expect(evaluateTransformationRule("{SUBSTR('Hello', 2, 4)}", {})).toBe('ell'));
});
