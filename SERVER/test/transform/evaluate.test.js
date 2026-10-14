/**
 * evaluate.test.js — exhaustive evaluateTransform coverage for every node kind,
 * edge inputs, and 2–3 level composition. Expected values are the INTENDED
 * semantics; failures here are transformation bugs to triage.
 */

import { describe } from 'vitest';
import {
    PERSON, NO_LAST, NULLS, NESTED,
    f, c, concat, fn, binop, cmp, iff, coalesce, valueMap,
    evalCases,
} from '../helpers/records.js';

describe('field node', () => {
    evalCases([
        { name: 'bare field reads record[name]', tree: f('FirstName'), record: PERSON, expected: 'John' },
        { name: 'object-prefixed path skips root segment', tree: f('Account.FirstName'), record: PERSON, expected: 'John' },
        { name: 'relationship path reads nested row', tree: f('Account.Contact.Comment'), record: NESTED, expected: 'VIP' },
        { name: 'deep relationship path', tree: f('X.Contact.Account.Name'), record: NESTED, expected: 'Acme Parent' },
        { name: 'missing field -> null', tree: f('Missing'), record: PERSON, expected: null },
        { name: 'field on empty record -> null', tree: f('FirstName'), record: {}, expected: null },
        { name: 'null value -> null', tree: f('FirstName'), record: NULLS, expected: null },
        { name: 'undefined value -> null', tree: f('LastName'), record: NULLS, expected: null },
        { name: 'empty string stays empty (not nil-coerced at field level)', tree: f('MiddleName'), record: PERSON, expected: '' },
    ]);
});

describe('const node', () => {
    evalCases([
        { name: 'string const', tree: c('hello'), expected: 'hello' },
        { name: 'number const', tree: c(42), expected: 42 },
        { name: 'boolean const', tree: c(true), expected: true },
        { name: 'zero const', tree: c(0), expected: 0 },
        { name: 'empty-string const', tree: c(''), expected: '' },
        { name: 'null const value', tree: c(null), expected: null },
    ]);
});

describe('concat node', () => {
    evalCases([
        { name: 'first + space + last', tree: concat(f('FirstName'), c(' '), f('LastName')), record: PERSON, expected: 'John Doe' },
        { name: 'empty last yields trailing space', tree: concat(f('FirstName'), c(' '), f('LastName')), record: NO_LAST, expected: 'Jane ' },
        { name: 'all-null parts -> empty string', tree: concat(f('FirstName'), f('LastName')), record: NULLS, expected: '' },
        { name: 'numbers stringified', tree: concat(c(1), c(2)), expected: '12' },
        { name: 'single part', tree: concat(c('x')), expected: 'x' },
        { name: 'prefix + field + suffix', tree: concat(c('ID-'), f('Age'), c('-END')), record: PERSON, expected: 'ID-30-END' },
    ]);
});

describe('func node (spot checks; full matrix in functions.test.js)', () => {
    evalCases([
        { name: 'UPPER', tree: fn('UPPER', f('FirstName')), record: PERSON, expected: 'JOHN' },
        { name: 'SUBSTR 1..2', tree: fn('SUBSTR', f('FirstName'), c(1), c(2)), record: PERSON, expected: 'Jo' },
        { name: 'TRIM', tree: fn('TRIM', f('City')), record: PERSON, expected: 'Berlin' },
    ]);
});

describe('binop node (numeric)', () => {
    evalCases([
        { name: 'add', tree: binop('+', c(2), c(3)), expected: 5 },
        { name: 'subtract', tree: binop('-', c(10), c(4)), expected: 6 },
        { name: 'multiply', tree: binop('*', c(3), c(4)), expected: 12 },
        { name: 'divide', tree: binop('/', c(10), c(4)), expected: 2.5 },
        { name: 'divide by zero -> null', tree: binop('/', c(5), c(0)), expected: null },
        { name: 'coerces numeric strings', tree: binop('+', f('Amount'), c(100)), record: PERSON, expected: 1100 },
        { name: 'null operand -> null', tree: binop('+', f('Missing'), c(1)), record: PERSON, expected: null },
        { name: 'non-numeric string -> null', tree: binop('+', f('FirstName'), c(1)), record: PERSON, expected: null },
        { name: 'nested precedence 2 + 3*4', tree: binop('+', c(2), binop('*', c(3), c(4))), expected: 14 },
    ]);
});

describe('compare node', () => {
    evalCases([
        { name: 'string equal', tree: cmp('=', f('Status'), c('A')), record: PERSON, expected: true },
        { name: 'string not-equal', tree: cmp('!=', f('Status'), c('B')), record: PERSON, expected: true },
        { name: 'numeric greater', tree: cmp('>', f('Age'), c(20)), record: PERSON, expected: true },
        { name: 'numeric less (false)', tree: cmp('<', f('Age'), c(20)), record: PERSON, expected: false },
        { name: 'ge equal', tree: cmp('>=', c(5), c(5)), expected: true },
        { name: 'le', tree: cmp('<=', c(4), c(5)), expected: true },
        { name: 'cross-type numeric coercion (\'5\' = 5)', tree: cmp('=', c('5'), c(5)), expected: true },
        { name: 'string equality', tree: cmp('=', c('abc'), c('abc')), expected: true },
        { name: 'string lexicographic less', tree: cmp('<', c('apple'), c('banana')), expected: true },
        { name: 'empty vs empty is equal', tree: cmp('=', f('MiddleName'), c('')), record: PERSON, expected: true },
        { name: 'field vs field numeric', tree: cmp('>', f('Amount'), f('Discount')), record: PERSON, expected: true },
    ]);
});

describe('if node', () => {
    const fullName = iff(cmp('=', f('LastName'), c('')), f('FirstName'), concat(f('FirstName'), c(' '), f('LastName')));
    evalCases([
        { name: 'full-name: has last -> concat', tree: fullName, record: PERSON, expected: 'John Doe' },
        { name: 'full-name: empty last -> first only', tree: fullName, record: NO_LAST, expected: 'Jane' },
        { name: 'boolean true -> then', tree: iff(c(true), c('yes'), c('no')), expected: 'yes' },
        { name: 'boolean false -> else', tree: iff(c(false), c('yes'), c('no')), expected: 'no' },
        { name: 'else null returns null', tree: { kind: 'if', cond: c(false), then: c('x'), else: null }, expected: null },
        { name: 'truthy non-empty string cond', tree: iff(f('FirstName'), c('has'), c('none')), record: PERSON, expected: 'has' },
        { name: 'empty-string cond is falsy', tree: iff(f('MiddleName'), c('has'), c('none')), record: PERSON, expected: 'none' },
        { name: 'literal "false" string is falsy', tree: iff(c('false'), c('t'), c('f')), expected: 'f' },
        { name: 'numeric 0 cond is truthy (edge)', tree: iff(c(0), c('t'), c('f')), expected: 't' },
    ]);
});

describe('coalesce node', () => {
    evalCases([
        { name: 'skips empty string', tree: coalesce(f('MiddleName'), f('FirstName')), record: PERSON, expected: 'John' },
        { name: 'skips null', tree: coalesce(f('Missing'), c('fallback')), record: PERSON, expected: 'fallback' },
        { name: 'returns first non-nil', tree: coalesce(f('FirstName'), f('LastName')), record: PERSON, expected: 'John' },
        { name: 'all nil -> null', tree: coalesce(f('Missing'), f('AlsoMissing')), record: PERSON, expected: null },
        { name: 'empty const skipped', tree: coalesce(c(''), c('x')), expected: 'x' },
        { name: 'zero is preserved (not nil)', tree: coalesce(c(0), c('x')), expected: 0 },
        { name: 'three args, third wins', tree: coalesce(f('MiddleName'), f('Missing'), c('last')), record: PERSON, expected: 'last' },
    ]);
});

describe('valueMap node', () => {
    evalCases([
        { name: 'maps known key', tree: valueMap(f('Status'), { A: 'Active', I: 'Inactive' }, c('Unknown')), record: PERSON, expected: 'Active' },
        { name: 'unknown key -> default', tree: valueMap(f('Status'), { X: 'y' }, c('Unknown')), record: PERSON, expected: 'Unknown' },
        { name: 'unknown key, no default -> null', tree: valueMap(f('Status'), { X: 'y' }), record: PERSON, expected: null },
        { name: 'numeric key coerced to string', tree: valueMap(f('Age'), { '30': 'thirty' }, c('other')), record: PERSON, expected: 'thirty' },
        { name: 'empty-string key maps', tree: valueMap(f('MiddleName'), { '': 'empty' }, c('d')), record: PERSON, expected: 'empty' },
        { name: 'stage mapping', tree: valueMap(f('Stage'), { Open: 'In Progress', Closed: 'Done' }, c('?')), record: PERSON, expected: 'In Progress' },
    ]);
});

describe('composition (nested kinds)', () => {
    evalCases([
        { name: 'UPPER(first) + UPPER(last)', tree: concat(fn('UPPER', f('FirstName')), c(' '), fn('UPPER', f('LastName'))), record: PERSON, expected: 'JOHN DOE' },
        { name: 'if over compare with numeric field', tree: iff(cmp('>', f('Amount'), c(500)), c('big'), c('small')), record: PERSON, expected: 'big' },
        { name: 'coalesce of valueMap miss then field', tree: coalesce(valueMap(f('Status'), { Z: 'z' }), f('FirstName')), record: PERSON, expected: 'John' },
        { name: 'greeting with coalesce inside concat', tree: concat(c('Hello, '), coalesce(f('MiddleName'), f('FirstName')), c('!')), record: PERSON, expected: 'Hello, John!' },
        { name: 'SUBSTR of UPPER of email', tree: fn('SUBSTR', fn('UPPER', f('Email')), c(1), c(4)), record: PERSON, expected: 'JOHN' },
        { name: 'arithmetic chain (Age*2)+5', tree: binop('+', binop('*', f('Age'), c(2)), c(5)), record: PERSON, expected: 65 },
    ]);
});
