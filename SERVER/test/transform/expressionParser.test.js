/**
 * expressionParser.test.js — the NEW rich parser (parseExpressionToTree): the
 * grammar the formula box actually uses on create/update. Pins precedence,
 * keywords, functions, the single-field brace rule, and error handling.
 */

import { describe, test, expect } from 'vitest';
import { parseExpressionToTree } from '../../src/utils/expressionParser.js';
import { evaluateTransform } from '../../src/utils/transformTree.js';
import { PERSON, NO_LAST } from '../helpers/records.js';

const parse = (formula) => parseExpressionToTree(formula);
const ev = (formula, rec) => evaluateTransform(parse(formula), rec ?? {});

describe('primaries', () => {
    test('bare field', () => expect(parse('FirstName')).toEqual({ kind: 'field', path: 'FirstName' }));
    test('dotted bare field', () => expect(parse('Account.Name')).toEqual({ kind: 'field', path: 'Account.Name' }));
    test('braced single field', () => expect(parse('{Account.Name}')).toEqual({ kind: 'field', path: 'Account.Name' }));
    test('number', () => expect(parse('42')).toEqual({ kind: 'const', value: 42 }));
    test('single-quoted string', () => expect(parse("'hi'")).toEqual({ kind: 'const', value: 'hi' }));
    test('double-quoted string', () => expect(parse('"hi"')).toEqual({ kind: 'const', value: 'hi' }));
});

describe('operators & precedence', () => {
    test('concat two fields', () => expect(parse('FirstName || LastName')).toEqual(
        { kind: 'concat', parts: [{ kind: 'field', path: 'FirstName' }, { kind: 'field', path: 'LastName' }] },
    ));
    test('concat three evaluates', () => expect(ev("FirstName || ' ' || LastName", PERSON)).toBe('John Doe'));
    test('addition tree', () => expect(parse('2 + 3')).toEqual(
        { kind: 'binop', op: '+', left: { kind: 'const', value: 2 }, right: { kind: 'const', value: 3 } },
    ));
    test('multiplication binds tighter than addition', () => expect(ev('2 + 3 * 4')).toBe(14));
    test('parentheses override precedence', () => expect(ev('(2 + 3) * 4')).toBe(20));
    test('unary minus', () => expect(ev('-5')).toBe(-5));
    test('left-to-right additive/multiplicative', () => expect(ev('10 / 2 - 1')).toBe(4));
    test('comparison tree', () => expect(parse('Age > 18')).toEqual(
        { kind: 'compare', op: '>', left: { kind: 'field', path: 'Age' }, right: { kind: 'const', value: 18 } },
    ));
    test('concat binds tighter than comparison', () => expect(ev("'a' || 'b' = 'ab'")).toBe(true));
});

describe('keywords & functions', () => {
    const fullName = "IF(LastName = '', FirstName, FirstName || ' ' || LastName)";
    test('IF then-branch (has last)', () => expect(ev(fullName, PERSON)).toBe('John Doe'));
    test('IF else-branch (empty last)', () => expect(ev(fullName, NO_LAST)).toBe('Jane'));
    test('COALESCE tree', () => expect(parse('COALESCE(MiddleName, FirstName)')).toEqual(
        { kind: 'coalesce', args: [{ kind: 'field', path: 'MiddleName' }, { kind: 'field', path: 'FirstName' }] },
    ));
    test('COALESCE skips empty', () => expect(ev('COALESCE(MiddleName, FirstName)', PERSON)).toBe('John'));
    test('SUBSTR evaluates', () => expect(ev('SUBSTR(FirstName, 1, 2)', PERSON)).toBe('Jo'));
    test('function name is case-insensitive', () => expect(parse('upper(FirstName)').name).toBe('UPPER'));
    test('nested functions', () => expect(ev('UPPER(SUBSTR(FirstName, 1, 2))', PERSON)).toBe('JO'));
    test('braced fields inside concat', () => expect(ev('{FirstName} || {LastName}', PERSON)).toBe('JohnDoe'));
});

describe('grammar edge: braces wrap exactly ONE field path', () => {
    test('single braced field is valid', () => expect(parse('{FirstName}')).toEqual({ kind: 'field', path: 'FirstName' }));
    test('braces around an expression throw', () => expect(() => parse('{FirstName || LastName}')).toThrow());
    test('braces around a function call throw', () => expect(() => parse('{SUBSTR(FirstName, 1, 2)}')).toThrow());
});

describe('errors', () => {
    test('empty string', () => expect(() => parse('')).toThrow());
    test('whitespace only', () => expect(() => parse('   ')).toThrow());
    test('unterminated string', () => expect(() => parse("'abc")).toThrow());
    test('unknown function', () => expect(() => parse('FOO(1)')).toThrow(/Unknown function/));
    test('IF wrong arity', () => expect(() => parse('IF(1, 2)')).toThrow(/IF expects exactly 3/));
    test('COALESCE no args', () => expect(() => parse('COALESCE()')).toThrow(/at least 1/));
    test('trailing tokens', () => expect(() => parse('1 2')).toThrow(/trailing tokens/));
    test('unbalanced parenthesis', () => expect(() => parse('(1 + 2')).toThrow());
    test('unexpected character', () => expect(() => parse('1 @ 2')).toThrow());
});
