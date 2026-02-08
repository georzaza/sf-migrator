/**
 * Example Frontend Test - Verifies test setup
 */

import { describe, it, expect } from 'vitest';

describe('Frontend Test Setup', () => {
    it('should run basic assertions', () => {
        expect(1 + 1).toBe(2);
        expect('test').toBeTypeOf('string');
        expect(true).toBe(true);
    });

    it('should test objects', () => {
        const obj = { name: 'test', value: 123 };
        expect(obj).toHaveProperty('name');
        expect(obj.name).toBe('test');
        expect(obj.value).toBe(123);
    });

    it('should test arrays', () => {
        const arr = [1, 2, 3];
        expect(arr).toBeInstanceOf(Array);
        expect(arr).toHaveLength(3);
        expect(arr).toContain(2);
    });
});
