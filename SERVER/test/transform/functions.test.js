/**
 * functions.test.js — exhaustive coverage of the FUNCTIONS table in transformTree.js.
 * Covers each function's happy path, null/empty handling, numeric-string coercion,
 * and boundary math (notably SUBSTR's 1-based inclusive-end semantics).
 */

import { describe } from 'vitest';
import { PERSON, f, c, fn, evalCases } from '../helpers/records.js';

describe('SUBSTR (1-based, inclusive end)', () => {
    evalCases([
        { name: 'leading slice 1..5', tree: fn('SUBSTR', c('Hello World'), c(1), c(5)), expected: 'Hello' },
        { name: 'middle slice 7..11', tree: fn('SUBSTR', c('Hello World'), c(7), c(11)), expected: 'World' },
        { name: 'interior 2..4', tree: fn('SUBSTR', c('Hello'), c(2), c(4)), expected: 'ell' },
        { name: 'single char 3..3', tree: fn('SUBSTR', c('Hello'), c(3), c(3)), expected: 'l' },
        { name: 'first char 1..1', tree: fn('SUBSTR', c('Hello'), c(1), c(1)), expected: 'H' },
        { name: 'end beyond length clamps', tree: fn('SUBSTR', c('Hello'), c(2), c(100)), expected: 'ello' },
        { name: 'start 0 treated as 1', tree: fn('SUBSTR', c('Hello'), c(0), c(2)), expected: 'He' },
        { name: 'null value -> empty', tree: fn('SUBSTR', f('Missing'), c(1), c(2)), record: PERSON, expected: '' },
        { name: 'numeric-string args coerced', tree: fn('SUBSTR', c('Hello'), c('2'), c('4')), expected: 'ell' },
        { name: 'over a field', tree: fn('SUBSTR', f('FirstName'), c(1), c(2)), record: PERSON, expected: 'Jo' },
    ]);
});

describe('LEN', () => {
    evalCases([
        { name: 'word length', tree: fn('LEN', c('Hello')), expected: 5 },
        { name: 'empty string', tree: fn('LEN', c('')), expected: 0 },
        { name: 'null -> 0', tree: fn('LEN', f('Missing')), record: PERSON, expected: 0 },
        { name: 'field length', tree: fn('LEN', f('FirstName')), record: PERSON, expected: 4 },
        { name: 'number stringified then measured', tree: fn('LEN', c(12345)), expected: 5 },
    ]);
});

describe('UPPER / LOWER', () => {
    evalCases([
        { name: 'UPPER basic', tree: fn('UPPER', c('hello')), expected: 'HELLO' },
        { name: 'UPPER sentence', tree: fn('UPPER', c('Hello World')), expected: 'HELLO WORLD' },
        { name: 'UPPER null -> empty', tree: fn('UPPER', f('Missing')), record: PERSON, expected: '' },
        { name: 'UPPER already-upper field', tree: fn('UPPER', f('Email')), record: PERSON, expected: 'JOHN@EXAMPLE.COM' },
        { name: 'LOWER basic', tree: fn('LOWER', c('HELLO')), expected: 'hello' },
        { name: 'LOWER email field', tree: fn('LOWER', f('Email')), record: PERSON, expected: 'john@example.com' },
        { name: 'LOWER null -> empty', tree: fn('LOWER', f('Missing')), record: PERSON, expected: '' },
        { name: 'case-insensitive function name', tree: fn('lower', c('ABC')), expected: 'abc' },
    ]);
});

describe('TRIM', () => {
    evalCases([
        { name: 'trims both ends', tree: fn('TRIM', c('  hi  ')), expected: 'hi' },
        { name: 'trims field', tree: fn('TRIM', f('City')), record: PERSON, expected: 'Berlin' },
        { name: 'no-op when clean', tree: fn('TRIM', c('nospace')), expected: 'nospace' },
        { name: 'null -> empty', tree: fn('TRIM', f('Missing')), record: PERSON, expected: '' },
    ]);
});

describe('DATE', () => {
    evalCases([
        { name: 'datetime -> date', tree: fn('DATE', c('2024-03-15T10:30:00Z')), expected: '2024-03-15' },
        { name: 'date passthrough', tree: fn('DATE', c('2024-03-15')), expected: '2024-03-15' },
        { name: 'from field', tree: fn('DATE', f('Created')), record: PERSON, expected: '2024-03-15' },
        { name: 'invalid -> null', tree: fn('DATE', c('not-a-date')), expected: null },
        { name: 'empty -> null', tree: fn('DATE', c('')), expected: null },
        { name: 'null -> null', tree: fn('DATE', f('Missing')), record: PERSON, expected: null },
    ]);
});

describe('DATETIME', () => {
    evalCases([
        { name: 'datetime passthrough (UTC)', tree: fn('DATETIME', c('2024-03-15T10:30:00Z')), expected: '2024-03-15T10:30:00Z' },
        { name: 'date -> midnight UTC', tree: fn('DATETIME', c('2024-03-15')), expected: '2024-03-15T00:00:00Z' },
        { name: 'invalid -> null', tree: fn('DATETIME', c('nope')), expected: null },
    ]);
});

describe('ADDDAYS', () => {
    evalCases([
        { name: 'add 5 days', tree: fn('ADDDAYS', c('2024-03-15'), c(5)), expected: '2024-03-20' },
        { name: 'add days drops time component', tree: fn('ADDDAYS', c('2024-03-15T10:30:00Z'), c(5)), expected: '2024-03-20' },
        { name: 'leap-year rollover', tree: fn('ADDDAYS', c('2024-02-28'), c(1)), expected: '2024-02-29' },
        { name: 'negative days', tree: fn('ADDDAYS', c('2024-03-15'), c(-5)), expected: '2024-03-10' },
        { name: 'invalid date -> null', tree: fn('ADDDAYS', c('bad'), c(5)), expected: null },
        { name: 'null days -> null', tree: fn('ADDDAYS', c('2024-03-15'), f('Missing')), record: PERSON, expected: null },
    ]);
});

describe('ADDHOURS', () => {
    evalCases([
        { name: 'add 5 hours', tree: fn('ADDHOURS', c('2024-03-15T10:00:00Z'), c(5)), expected: '2024-03-15T15:00:00Z' },
        { name: 'cross midnight', tree: fn('ADDHOURS', c('2024-03-15T22:00:00Z'), c(5)), expected: '2024-03-16T03:00:00Z' },
        { name: 'negative hours', tree: fn('ADDHOURS', c('2024-03-15T10:00:00Z'), c(-2)), expected: '2024-03-15T08:00:00Z' },
        { name: 'from date-only midnight', tree: fn('ADDHOURS', c('2024-03-15'), c(1)), expected: '2024-03-15T01:00:00Z' },
        { name: 'invalid -> null', tree: fn('ADDHOURS', c('bad'), c(1)), expected: null },
    ]);
});
