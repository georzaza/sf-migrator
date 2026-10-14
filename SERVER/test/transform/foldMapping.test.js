/**
 * foldMapping.test.js — mappingToTree folds legacy as-is/constant/expression rows
 * and the new transform JSONB into one tree. NOTE: the expression branch compiles
 * via the LEGACY parser (dslToTree), which only accepts dotted field refs, `||`,
 * string literals and SUBSTR. Rich-formula divergences live in
 * parserReconciliation.test.js.
 */

import { describe, test, expect } from 'vitest';
import { mappingToTree, evaluateTransform } from '../../src/utils/transformTree.js';
import { PERSON } from '../helpers/records.js';

describe('mappingToTree precedence + folding', () => {
    test('transform JSONB wins over legacy columns', () => {
        const mapping = { transform: { kind: 'const', value: 'X' }, mappingType: 'as-is', sourceField: { name: 'FirstName' } };
        expect(mappingToTree(mapping)).toEqual({ kind: 'const', value: 'X' });
    });

    test('as-is -> field node', () => {
        const mapping = { mappingType: 'as-is', sourceField: { name: 'FirstName' } };
        expect(mappingToTree(mapping)).toEqual({ kind: 'field', path: 'FirstName' });
        expect(evaluateTransform(mappingToTree(mapping), PERSON)).toBe('John');
    });

    test('default mappingType is as-is', () => {
        const mapping = { sourceField: { name: 'FirstName' } };
        expect(mappingToTree(mapping)).toEqual({ kind: 'field', path: 'FirstName' });
    });

    test('constant -> const node', () => {
        const mapping = { mappingType: 'constant', constantValue: 'HELLO' };
        expect(mappingToTree(mapping)).toEqual({ kind: 'const', value: 'HELLO' });
        expect(evaluateTransform(mappingToTree(mapping), PERSON)).toBe('HELLO');
    });

    test('constant null value', () => {
        const mapping = { mappingType: 'constant', constantValue: null };
        expect(mappingToTree(mapping)).toEqual({ kind: 'const', value: null });
    });

    test('expression (legacy dotted DSL) -> concat tree', () => {
        const mapping = { mappingType: 'expression', transformationRule: "{Account.Name || '-'}" };
        expect(mappingToTree(mapping)).toEqual({
            kind: 'concat',
            parts: [{ kind: 'field', path: 'Account.Name' }, { kind: 'const', value: '-' }],
        });
        expect(evaluateTransform(mappingToTree(mapping), { Name: 'Acme' })).toBe('Acme-');
    });
});

describe('mappingToTree error cases', () => {
    test('as-is without source field throws', () => {
        expect(() => mappingToTree({ mappingType: 'as-is' })).toThrow(/no source field/);
    });
    test('expression without rule throws', () => {
        expect(() => mappingToTree({ mappingType: 'expression' })).toThrow(/no transformation rule/);
    });
    test('unknown mapping type throws', () => {
        expect(() => mappingToTree({ mappingType: 'weird' })).toThrow(/Unknown mapping type/);
    });
});
