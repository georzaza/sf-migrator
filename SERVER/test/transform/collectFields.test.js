/**
 * collectFields.test.js — collectTransformFields must return exactly the set of
 * source field paths a tree reads. This drives extraction, so an omission means
 * the pipeline queries the wrong columns and values silently go null.
 */

import { describe, test, expect } from 'vitest';
import { collectTransformFields } from '../../src/utils/transformTree.js';
import { f, c, fn, binop, cmp, iff, coalesce, valueMap, concat } from '../helpers/records.js';

function paths(tree) {
    return [...collectTransformFields(tree)].sort();
}

const cases = [
    { name: 'field', tree: f('Account.Name'), expected: ['Account.Name'] },
    { name: 'const collects nothing', tree: c('x'), expected: [] },
    { name: 'concat collects each part', tree: concat(f('A'), c('-'), f('B')), expected: ['A', 'B'] },
    { name: 'func single field arg', tree: fn('SUBSTR', f('A'), c(1), c(2)), expected: ['A'] },
    { name: 'func multiple field args', tree: fn('ADDDAYS', f('D'), f('N')), expected: ['D', 'N'] },
    { name: 'binop both operands', tree: binop('+', f('X'), f('Y')), expected: ['X', 'Y'] },
    { name: 'compare left field', tree: cmp('=', f('A'), c('x')), expected: ['A'] },
    { name: 'if cond/then/else', tree: iff(cmp('=', f('A'), c('')), f('B'), f('C')), expected: ['A', 'B', 'C'] },
    { name: 'if without else', tree: { kind: 'if', cond: cmp('=', f('A'), c('x')), then: f('B') }, expected: ['A', 'B'] },
    { name: 'coalesce args', tree: coalesce(f('A'), f('B'), c('x')), expected: ['A', 'B'] },
    { name: 'valueMap input only (literals ignored)', tree: valueMap(f('Status'), { A: 'x' }, c('d')), expected: ['Status'] },
    { name: 'valueMap with field default', tree: { kind: 'valueMap', input: f('A'), table: {}, default: f('B') }, expected: ['A', 'B'] },
    { name: 'nested functions', tree: concat(fn('UPPER', f('First')), c(' '), fn('LOWER', f('Last'))), expected: ['First', 'Last'] },
    { name: 'duplicate paths deduped', tree: concat(f('A'), f('A')), expected: ['A'] },
    { name: 'relationship paths preserved', tree: concat(f('Account.Owner.Name'), f('Account.Name')), expected: ['Account.Name', 'Account.Owner.Name'] },
];

describe('collectTransformFields', () => {
    for (const tc of cases) {
        test(tc.name, () => {
            expect(paths(tc.tree)).toEqual([...tc.expected].sort());
        });
    }
});
