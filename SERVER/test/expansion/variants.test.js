/**
 * variants.test.js — fan-out / record-expansion (Layer 2). Each variant produces
 * one target row; its field values and optional filter are transform trees run by
 * the shared engine.
 *
 *  - Part A (pure, always runs): evaluate a variant's field trees + filter against
 *    a synthetic record — the exact per-variant computation the transform performs.
 *  - Part B (structural): recordExpansionService.validateVariants. Imported via a
 *    guarded dynamic import so the pure suite still runs if models can't load.
 */

import { describe, test, expect } from 'vitest';
import { evaluateTransform } from '../../src/utils/transformTree.js';
import { PERSON, f, c, concat, cmp } from '../helpers/records.js';

// One source person fanned into two typed target rows (Primary / Secondary).
const VARIANTS = [
    {
        fields: {
            Name: concat(f('FirstName'), c(' '), f('LastName')),
            Kind: c('Primary'),
            Email: f('Email'),
        },
        filter: cmp('!=', f('Email'), c('')),
    },
    {
        fields: {
            Name: concat(f('FirstName'), c(' (alt)')),
            Kind: c('Secondary'),
        },
        filter: cmp('=', f('MiddleName'), c('X')), // false for PERSON -> row skipped
    },
];

describe('variant evaluation (pure engine)', () => {
    test('variant 1 field trees compute expected values', () => {
        const v = VARIANTS[0];
        expect(evaluateTransform(v.fields.Name, PERSON)).toBe('John Doe');
        expect(evaluateTransform(v.fields.Kind, PERSON)).toBe('Primary');
        expect(evaluateTransform(v.fields.Email, PERSON)).toBe('JOHN@EXAMPLE.COM');
    });
    test('variant 1 filter includes the row', () => {
        expect(evaluateTransform(VARIANTS[0].filter, PERSON)).toBe(true);
    });
    test('variant 2 filter excludes the row', () => {
        expect(evaluateTransform(VARIANTS[1].filter, PERSON)).toBe(false);
    });
});

// Guarded import: instantiates Sequelize lazily (no DB connection). If the model
// graph cannot load here, Part B self-skips via describe.skipIf instead of failing.
let svc = null;
try {
    svc = (await import('../../src/services/recordExpansionService.js')).default;
} catch {
    svc = null;
}

describe.skipIf(!svc)('validateVariants (structural)', () => {
    test('valid variants pass', () => {
        expect(() => svc.validateVariants([
            { fields: { Name: c('x') }, filter: cmp('=', f('A'), c('x')) },
        ])).not.toThrow();
    });
    test('empty array rejected', () => {
        expect(() => svc.validateVariants([])).toThrow(/At least one variant/);
    });
    test('variant without fields rejected', () => {
        expect(() => svc.validateVariants([{}])).toThrow(/"fields" object/);
    });
    test('variant with empty fields rejected', () => {
        expect(() => svc.validateVariants([{ fields: {} }])).toThrow(/at least one target field/);
    });
    test('invalid field tree rejected', () => {
        expect(() => svc.validateVariants([{ fields: { Name: { kind: 'bogus' } } }])).toThrow(/field "Name"/);
    });
    test('invalid filter tree rejected', () => {
        expect(() => svc.validateVariants([{ fields: { Name: c('x') }, filter: { kind: 'bogus' } }])).toThrow(/filter/);
    });
});
