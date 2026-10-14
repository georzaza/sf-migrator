/**
 * validate.test.js — validateTransform accept/reject matrix across every node kind.
 * Valid trees must return true; malformed trees must throw (recursively).
 */

import { describe } from 'vitest';
import { f, c, fn, binop, cmp, iff, coalesce, valueMap, concat, validateCases } from '../helpers/records.js';

describe('valid trees are accepted', () => {
    validateCases([
        { name: 'field', tree: f('Account.Name') },
        { name: 'const string', tree: c('x') },
        { name: 'const null value', tree: c(null) },
        { name: 'const zero', tree: c(0) },
        { name: 'const empty string', tree: c('') },
        { name: 'concat', tree: concat(f('A'), c('-'), f('B')) },
        { name: 'func UPPER (1 arg)', tree: fn('UPPER', f('A')) },
        { name: 'func SUBSTR (3 args)', tree: fn('SUBSTR', f('A'), c(1), c(3)) },
        { name: 'binop', tree: binop('+', c(1), c(2)) },
        { name: 'compare', tree: cmp('=', f('A'), c('x')) },
        { name: 'if with else', tree: iff(cmp('=', f('A'), c('x')), c('y'), c('z')) },
        { name: 'if without else', tree: { kind: 'if', cond: c(true), then: c('a') } },
        { name: 'coalesce', tree: coalesce(f('A'), c('fallback')) },
        { name: 'valueMap with default', tree: valueMap(f('A'), { a: 'b' }, c('d')) },
        { name: 'valueMap without default', tree: { kind: 'valueMap', input: f('A'), table: { a: 'b' } } },
    ]);
});

describe('malformed trees are rejected', () => {
    validateCases([
        { name: 'null is not a node', tree: null, throws: true },
        { name: 'missing kind', tree: { path: 'x' }, throws: true },
        { name: 'unknown kind', tree: { kind: 'bogus' }, throws: /Unknown transform node kind/ },
        { name: 'field missing path', tree: { kind: 'field' }, throws: /non-empty "path"/ },
        { name: 'field empty path', tree: { kind: 'field', path: '' }, throws: true },
        { name: 'field non-string path', tree: { kind: 'field', path: 5 }, throws: true },
        { name: 'const missing value', tree: { kind: 'const' }, throws: /requires a "value"/ },
        { name: 'concat missing parts', tree: { kind: 'concat' }, throws: true },
        { name: 'concat empty parts', tree: { kind: 'concat', parts: [] }, throws: true },
        { name: 'concat invalid child', tree: { kind: 'concat', parts: [{ kind: 'bogus' }] }, throws: true },
        { name: 'func unknown name', tree: { kind: 'func', name: 'FOO', args: [] }, throws: /Unknown function/ },
        { name: 'func missing args', tree: { kind: 'func', name: 'UPPER' }, throws: true },
        { name: 'func too many args', tree: { kind: 'func', name: 'UPPER', args: [c('a'), c('b')] }, throws: /expects/ },
        { name: 'func SUBSTR too few args', tree: { kind: 'func', name: 'SUBSTR', args: [c('a')] }, throws: /expects/ },
        { name: 'binop bad op', tree: { kind: 'binop', op: '%', left: c(1), right: c(2) }, throws: /Invalid binop op/ },
        { name: 'binop missing operand', tree: { kind: 'binop', op: '+', left: c(1) }, throws: true },
        { name: 'compare bad op', tree: { kind: 'compare', op: '~', left: c(1), right: c(2) }, throws: /Invalid compare op/ },
        { name: 'if invalid cond', tree: { kind: 'if', cond: { kind: 'bogus' }, then: c(1) }, throws: true },
        { name: 'coalesce missing args', tree: { kind: 'coalesce' }, throws: true },
        { name: 'coalesce empty args', tree: { kind: 'coalesce', args: [] }, throws: true },
        { name: 'valueMap missing table', tree: { kind: 'valueMap', input: c('a') }, throws: /"table" object/ },
        { name: 'valueMap table is array', tree: { kind: 'valueMap', input: c('a'), table: [] }, throws: /"table" object/ },
        { name: 'valueMap invalid input', tree: { kind: 'valueMap', input: { kind: 'bogus' }, table: {} }, throws: true },
    ]);
});
