/**
 * serialization.test.js — the stg2 column-value contract (toCellValue), used by
 * transformService.computeFieldValue. null/undefined become SQL null; every other
 * value (including empty string, 0 and false) is stringified. The null-vs-empty
 * distinction matters: an unmapped/missing source is null, a present-but-empty
 * source is "".
 */

import { describe, test, expect } from 'vitest';
import { toCellValue, evaluateTransform } from '../../src/utils/transformTree.js';
import { PERSON, f, c, concat, cmp, binop, coalesce } from '../helpers/records.js';

describe('toCellValue primitives', () => {
    const cases = [
        { name: 'null -> null', in: null, out: null },
        { name: 'undefined -> null', in: undefined, out: null },
        { name: 'empty string stays ""', in: '', out: '' },
        { name: 'text passthrough', in: 'text', out: 'text' },
        { name: 'zero -> "0"', in: 0, out: '0' },
        { name: 'integer -> string', in: 42, out: '42' },
        { name: 'float -> string', in: 2.5, out: '2.5' },
        { name: 'true -> "true"', in: true, out: 'true' },
        { name: 'false -> "false"', in: false, out: 'false' },
    ];
    for (const tc of cases) {
        test(tc.name, () => expect(toCellValue(tc.in)).toBe(tc.out));
    }
});

describe('evaluate -> serialize integration', () => {
    test('string result', () => expect(toCellValue(evaluateTransform(concat(f('FirstName'), c(' '), f('LastName')), PERSON))).toBe('John Doe'));
    test('boolean result stringified', () => expect(toCellValue(evaluateTransform(cmp('>', f('Age'), c(18)), PERSON))).toBe('true'));
    test('numeric result stringified', () => expect(toCellValue(evaluateTransform(binop('*', f('Age'), c(2)), PERSON))).toBe('60'));
    test('present-but-empty field stays ""', () => expect(toCellValue(evaluateTransform(f('MiddleName'), PERSON))).toBe(''));
    test('missing field becomes null', () => expect(toCellValue(evaluateTransform(f('Missing'), PERSON))).toBe(null));
    test('all-nil coalesce becomes null', () => expect(toCellValue(evaluateTransform(coalesce(f('Missing'), f('Absent')), PERSON))).toBe(null));
});
