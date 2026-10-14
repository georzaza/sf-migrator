/**
 * Shared fixtures + table-runner helpers for the transform DSL test suite.
 *
 * These tests exercise the pure engine (SERVER/src/utils/*) with no database.
 * Expected values encode the INTENDED/CORRECT behavior of each capability, so a
 * failing case is a real transformation bug to triage — not a reason to loosen
 * the assertion to match current output.
 *
 * Field-path note: readFieldPath treats the FIRST path segment as the record
 * root label (it is skipped), and indexes the remainder into the record. So
 * `FirstName`, `Account.FirstName` and `X.FirstName` all read record.FirstName;
 * `Account.Contact.Comment` reads record.Contact.Comment. Fixtures below are
 * shaped to match that traversal.
 */

import { test, expect } from 'vitest';
import { evaluateTransform, validateTransform } from '../../src/utils/transformTree.js';

/** A flat "person" source record (values are strings, mirroring stg1 TEXT columns). */
export const PERSON = {
    FirstName: 'John',
    LastName: 'Doe',
    MiddleName: '',
    Salutation: 'Mr',
    Age: '30',
    Status: 'A',
    Stage: 'Open',
    Amount: '1000',
    Discount: '0',
    Email: 'JOHN@EXAMPLE.COM',
    City: '  Berlin  ',
    Created: '2024-03-15T10:30:00Z',
    Active: 'true',
};

/** A person whose last name is empty (the classic full-name edge case). */
export const NO_LAST = { FirstName: 'Jane', LastName: '' };

/** A record with explicit null/undefined to probe nil handling. */
export const NULLS = { FirstName: null, LastName: undefined, Amount: '' };

/** A nested record (driving object with a resolved relationship row attached). */
export const NESTED = {
    Name: 'Acme',
    Contact: { Comment: 'VIP', Email: 'c@acme.com', Account: { Name: 'Acme Parent' } },
};

/** Convenience node builders to keep case tables readable. */
export const f = (path) => ({ kind: 'field', path });
export const c = (value) => ({ kind: 'const', value });
export const concat = (...parts) => ({ kind: 'concat', parts });
export const fn = (name, ...args) => ({ kind: 'func', name, args });
export const binop = (op, left, right) => ({ kind: 'binop', op, left, right });
export const cmp = (op, left, right) => ({ kind: 'compare', op, left, right });
export const iff = (cond, then, els) => ({ kind: 'if', cond, then, else: els });
export const coalesce = (...args) => ({ kind: 'coalesce', args });
export const valueMap = (input, table, dflt) => ({ kind: 'valueMap', input, table, default: dflt });

/**
 * Register one Vitest test per row. Each case:
 *   { name, tree, record?, expected }
 * Asserts evaluateTransform(tree, record) deep-equals expected.
 */
export function evalCases(cases) {
    test.each(cases)('$name', (tc) => {
        const out = evaluateTransform(tc.tree, tc.record ?? {});
        expect(out, `tree: ${JSON.stringify(tc.tree)}`).toEqual(tc.expected);
    });
}

/**
 * Register one Vitest test per row asserting validation outcome. Each case:
 *   { name, tree, throws?: boolean | RegExp }
 * throws omitted/false => must validate; RegExp => must throw matching message.
 */
export function validateCases(cases) {
    test.each(cases)('$name', (tc) => {
        if (!tc.throws) {
            expect(validateTransform(tc.tree)).toBe(true);
        } else if (tc.throws instanceof RegExp) {
            expect(() => validateTransform(tc.tree)).toThrow(tc.throws);
        } else {
            expect(() => validateTransform(tc.tree)).toThrow();
        }
    });
}
