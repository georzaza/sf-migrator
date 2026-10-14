/**
 * Transform tree — the canonical, composable representation of a Layer-1
 * (value-level) field transformation. See docs/TRANSFORMATIONS.md.
 *
 * A transform is a tree of typed nodes stored as JSONB on FieldMapping.transform.
 * Legacy mappings (`as-is` / `expression` / `constant`) are folded into the same
 * tree via `mappingToTree`, so a single evaluator/collector/validator drives
 * extraction, transform, and validation.
 *
 * Every node kind registers four concerns:
 *   validate(node, ctx)            structural + semantic checks (throws on error)
 *   evaluate(node, record, ctx)    compute the value for a source record
 *   collectFields(node, set)       source field paths the node reads
 *   outputType(node, ctx)          inferred result type (advisory)
 *
 * Values flow as native JS (string | number | boolean | Date | null). The caller
 * (transformService) is responsible for final serialization to the target column.
 */

import { parseTransformationRule } from './transformationRule.js';
import logger from '../lib/logger.js';
const log = logger.create('transformTree');

/* ------------------------------------------------------------------ helpers */

function isNil(v) {
    return v === null || v === undefined || v === '';
}

function toNumber(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
}

function toStr(v) {
    return v === null || v === undefined ? '' : String(v);
}

function toDate(v) {
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
    if (isNil(v)) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function pad(n) {
    return String(n).padStart(2, '0');
}

function formatDate(d) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function formatDateTime(d) {
    return `${formatDate(d)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}

/**
 * Read a (possibly dotted, possibly relationship) field path out of a source
 * record. Mirrors the legacy getFieldValue: the first segment is the object /
 * relationship root; the remainder indexes into the (nested or flattened) record.
 */
function readFieldPath(record, path) {
    if (!record || !path) return null;
    const segments = String(path).split('.');
    const rest = segments.slice(1);

    // Bare field name (no object prefix): read directly.
    if (rest.length === 0) {
        const direct = record[segments[0]];
        return direct === undefined ? null : direct;
    }

    let current = record;
    for (const seg of rest) {
        if (current === null || current === undefined) break;
        current = current[seg];
    }

    if (current === null || current === undefined) {
        const flatKey = rest.join('.');
        const leafKey = rest[rest.length - 1];
        current = record[flatKey] ?? record[leafKey] ?? null;
    }

    return current === undefined ? null : current;
}

/* ------------------------------------------------------------- function table */

/**
 * Scalar functions usable via the `func` node. Each entry declares arity bounds
 * and an implementation over already-evaluated argument values.
 */
export const FUNCTIONS = {
    SUBSTR: {
        minArgs: 3,
        maxArgs: 3,
        outputType: () => 'text',
        apply: (args) => {
            const value = toStr(args[0]);
            const start = Math.max(toNumber(args[1]) - 1, 0);
            const end = toNumber(args[2]);
            const length = Math.max(end - (start + 1) + 1, 0);
            return value.substring(start, start + length);
        },
    },
    LEN: {
        minArgs: 1,
        maxArgs: 1,
        outputType: () => 'number',
        apply: (args) => toStr(args[0]).length,
    },
    UPPER: { minArgs: 1, maxArgs: 1, outputType: () => 'text', apply: (a) => toStr(a[0]).toUpperCase() },
    LOWER: { minArgs: 1, maxArgs: 1, outputType: () => 'text', apply: (a) => toStr(a[0]).toLowerCase() },
    TRIM: { minArgs: 1, maxArgs: 1, outputType: () => 'text', apply: (a) => toStr(a[0]).trim() },
    DATE: {
        minArgs: 1,
        maxArgs: 1,
        outputType: () => 'date',
        apply: (args) => {
            const d = toDate(args[0]);
            return d ? formatDate(d) : null;
        },
    },
    DATETIME: {
        minArgs: 1,
        maxArgs: 1,
        outputType: () => 'datetime',
        apply: (args) => {
            const d = toDate(args[0]);
            return d ? formatDateTime(d) : null;
        },
    },
    ADDDAYS: {
        minArgs: 2,
        maxArgs: 2,
        outputType: () => 'date',
        apply: (args) => {
            const d = toDate(args[0]);
            const days = toNumber(args[1]);
            if (!d || days === null) return null;
            d.setUTCDate(d.getUTCDate() + days);
            return formatDate(d);
        },
    },
    ADDHOURS: {
        minArgs: 2,
        maxArgs: 2,
        outputType: () => 'datetime',
        apply: (args) => {
            const d = toDate(args[0]);
            const hours = toNumber(args[1]);
            if (!d || hours === null) return null;
            d.setUTCHours(d.getUTCHours() + hours);
            return formatDateTime(d);
        },
    },
};

/* ---------------------------------------------------------------- node registry */

const NODES = {
    field: {
        validate(node) {
            if (typeof node.path !== 'string' || !node.path.trim()) {
                throw new Error('field node requires a non-empty "path"');
            }
        },
        evaluate(node, record) {
            return readFieldPath(record, node.path);
        },
        collectFields(node, set) {
            set.add(node.path);
        },
        outputType() {
            return 'text';
        },
    },

    const: {
        validate(node) {
            if (!('value' in node)) {
                throw new Error('const node requires a "value"');
            }
        },
        evaluate(node) {
            return node.value === undefined ? null : node.value;
        },
        collectFields() {},
        outputType(node) {
            if (typeof node.value === 'number') return 'number';
            if (typeof node.value === 'boolean') return 'boolean';
            return 'text';
        },
    },

    concat: {
        validate(node, ctx) {
            if (!Array.isArray(node.parts) || node.parts.length === 0) {
                throw new Error('concat node requires a non-empty "parts" array');
            }
            node.parts.forEach((p) => validateNode(p, ctx));
        },
        evaluate(node, record, ctx) {
            return node.parts.map((p) => toStr(evaluateNode(p, record, ctx))).join('');
        },
        collectFields(node, set) {
            node.parts.forEach((p) => collectNodeFields(p, set));
        },
        outputType() {
            return 'text';
        },
    },

    func: {
        validate(node, ctx) {
            const fn = FUNCTIONS[String(node.name || '').toUpperCase()];
            if (!fn) throw new Error(`Unknown function: ${node.name}`);
            if (!Array.isArray(node.args)) throw new Error(`func ${node.name} requires "args"`);
            if (node.args.length < fn.minArgs || node.args.length > fn.maxArgs) {
                throw new Error(`func ${node.name} expects ${fn.minArgs}..${fn.maxArgs} args, got ${node.args.length}`);
            }
            node.args.forEach((a) => validateNode(a, ctx));
        },
        evaluate(node, record, ctx) {
            const fn = FUNCTIONS[String(node.name).toUpperCase()];
            const args = node.args.map((a) => evaluateNode(a, record, ctx));
            return fn.apply(args);
        },
        collectFields(node, set) {
            (node.args || []).forEach((a) => collectNodeFields(a, set));
        },
        outputType(node, ctx) {
            const fn = FUNCTIONS[String(node.name).toUpperCase()];
            return fn ? fn.outputType(node, ctx) : 'other';
        },
    },

    binop: {
        validate(node, ctx) {
            if (!['+', '-', '*', '/'].includes(node.op)) throw new Error(`Invalid binop op: ${node.op}`);
            validateNode(node.left, ctx);
            validateNode(node.right, ctx);
        },
        evaluate(node, record, ctx) {
            const l = toNumber(evaluateNode(node.left, record, ctx));
            const r = toNumber(evaluateNode(node.right, record, ctx));
            if (l === null || r === null) return null;
            switch (node.op) {
                case '+': return l + r;
                case '-': return l - r;
                case '*': return l * r;
                case '/': return r === 0 ? null : l / r;
                default: return null;
            }
        },
        collectFields(node, set) {
            collectNodeFields(node.left, set);
            collectNodeFields(node.right, set);
        },
        outputType() {
            return 'number';
        },
    },

    compare: {
        validate(node, ctx) {
            if (!['=', '!=', '<', '<=', '>', '>='].includes(node.op)) {
                throw new Error(`Invalid compare op: ${node.op}`);
            }
            validateNode(node.left, ctx);
            validateNode(node.right, ctx);
        },
        evaluate(node, record, ctx) {
            const l = evaluateNode(node.left, record, ctx);
            const r = evaluateNode(node.right, record, ctx);
            const ln = toNumber(l);
            const rn = toNumber(r);
            const numeric = ln !== null && rn !== null;
            const a = numeric ? ln : toStr(l);
            const b = numeric ? rn : toStr(r);
            switch (node.op) {
                case '=': return a === b;
                case '!=': return a !== b;
                case '<': return a < b;
                case '<=': return a <= b;
                case '>': return a > b;
                case '>=': return a >= b;
                default: return false;
            }
        },
        collectFields(node, set) {
            collectNodeFields(node.left, set);
            collectNodeFields(node.right, set);
        },
        outputType() {
            return 'boolean';
        },
    },

    if: {
        validate(node, ctx) {
            validateNode(node.cond, ctx);
            validateNode(node.then, ctx);
            if (node.else !== undefined && node.else !== null) validateNode(node.else, ctx);
        },
        evaluate(node, record, ctx) {
            const cond = evaluateNode(node.cond, record, ctx);
            const truthy = typeof cond === 'boolean' ? cond : !isNil(cond) && cond !== false && cond !== 'false';
            if (truthy) return evaluateNode(node.then, record, ctx);
            return node.else ? evaluateNode(node.else, record, ctx) : null;
        },
        collectFields(node, set) {
            collectNodeFields(node.cond, set);
            collectNodeFields(node.then, set);
            if (node.else) collectNodeFields(node.else, set);
        },
        outputType(node, ctx) {
            return outputTypeOf(node.then, ctx);
        },
    },

    coalesce: {
        validate(node, ctx) {
            if (!Array.isArray(node.args) || node.args.length === 0) {
                throw new Error('coalesce node requires a non-empty "args" array');
            }
            node.args.forEach((a) => validateNode(a, ctx));
        },
        evaluate(node, record, ctx) {
            for (const a of node.args) {
                const v = evaluateNode(a, record, ctx);
                if (!isNil(v)) return v;
            }
            return null;
        },
        collectFields(node, set) {
            node.args.forEach((a) => collectNodeFields(a, set));
        },
        outputType(node, ctx) {
            return outputTypeOf(node.args[0], ctx);
        },
    },

    valueMap: {
        validate(node, ctx) {
            validateNode(node.input, ctx);
            if (!node.table || typeof node.table !== 'object' || Array.isArray(node.table)) {
                throw new Error('valueMap node requires a "table" object');
            }
            if (node.default !== undefined && node.default !== null) validateNode(node.default, ctx);
        },
        evaluate(node, record, ctx) {
            const key = toStr(evaluateNode(node.input, record, ctx));
            if (Object.prototype.hasOwnProperty.call(node.table, key)) {
                return node.table[key];
            }
            return node.default ? evaluateNode(node.default, record, ctx) : null;
        },
        collectFields(node, set) {
            collectNodeFields(node.input, set);
            if (node.default) collectNodeFields(node.default, set);
        },
        outputType() {
            return 'text';
        },
    },
};

/* ------------------------------------------------------------------ dispatch */

function nodeHandler(node) {
    if (!node || typeof node !== 'object' || typeof node.kind !== 'string') {
        throw new Error('Transform node must be an object with a "kind"');
    }
    const handler = NODES[node.kind];
    if (!handler) throw new Error(`Unknown transform node kind: ${node.kind}`);
    return handler;
}

export function validateNode(node, ctx = {}) {
    nodeHandler(node).validate(node, ctx);
    return true;
}

export function evaluateNode(node, record, ctx = {}) {
    return nodeHandler(node).evaluate(node, record, ctx);
}

export function collectNodeFields(node, set = new Set()) {
    nodeHandler(node).collectFields(node, set);
    return set;
}

export function outputTypeOf(node, ctx = {}) {
    return nodeHandler(node).outputType(node, ctx);
}

/**
 * Validate a complete transform tree. Returns true or throws with a message.
 */
export function validateTransform(tree, ctx = {}) {
    return validateNode(tree, ctx);
}

/**
 * Evaluate a transform tree against a source record and return the native value.
 */
export function evaluateTransform(tree, record, ctx = {}) {
    return evaluateNode(tree, record, ctx);
}

/**
 * Serialize an evaluated value into the TEXT form written to an stg2 column.
 * Null/undefined become null; everything else is stringified.
 */
export function toCellValue(result) {
    return result === undefined || result === null ? null : String(result);
}

/**
 * Collect every source field path referenced anywhere in the tree.
 */
export function collectTransformFields(tree, set = new Set()) {
    return collectNodeFields(tree, set);
}

/* --------------------------------------------------------------- DSL <-> tree */

/**
 * Compile a legacy DSL AST (from transformationRule.js) into a transform tree.
 */
export function astToTree(ast) {
    if (!ast || typeof ast !== 'object') {
        throw new Error('Invalid DSL AST');
    }
    switch (ast.type) {
        case 'fieldRef':
            return { kind: 'field', path: ast.value };
        case 'literal':
            return { kind: 'const', value: ast.value };
        case 'concat':
            return { kind: 'concat', parts: ast.parts.map(astToTree) };
        case 'substr':
            return {
                kind: 'func',
                name: 'SUBSTR',
                args: [astToTree(ast.value), { kind: 'const', value: ast.start }, { kind: 'const', value: ast.end }],
            };
        default:
            throw new Error(`Cannot compile DSL node of type "${ast.type}" to a transform tree`);
    }
}

/**
 * Compile a legacy DSL string (e.g. "{Account.Name || '-'}") into a transform tree.
 */
export function dslToTree(rule) {
    return astToTree(parseTransformationRule(rule));
}

/**
 * Best-effort printer: render a transform tree back to the legacy DSL string.
 * Only the subset representable by the DSL is supported; richer nodes throw.
 */
export function treeToDsl(tree) {
    return `{${printInner(tree)}}`;
}

function printInner(node) {
    switch (node.kind) {
        case 'field':
            return node.path;
        case 'const':
            return typeof node.value === 'number' ? String(node.value) : `'${String(node.value).replace(/'/g, "")}'`;
        case 'concat':
            return node.parts.map(printInner).join(' || ');
        case 'func':
            if (String(node.name).toUpperCase() === 'SUBSTR') {
                return `SUBSTR(${printInner(node.args[0])}, ${printInner(node.args[1])}, ${printInner(node.args[2])})`;
            }
            throw new Error(`Function ${node.name} is not representable in the legacy DSL`);
        default:
            throw new Error(`Node kind "${node.kind}" is not representable in the legacy DSL`);
    }
}

/* ------------------------------------------------------ legacy mapping -> tree */

/**
 * Produce the canonical transform tree for a FieldMapping. Precedence:
 *   1. mapping.transform (JSONB) if present — the new source of truth,
 *   2. otherwise derived from the legacy mappingType columns.
 *
 * This keeps every consumer on a single evaluator while remaining backward
 * compatible with `as-is` / `expression` / `constant` rows.
 */
export function mappingToTree(mapping) {
    if (mapping && mapping.transform) {
        return mapping.transform;
    }

    const type = mapping?.mappingType || 'as-is';

    if (type === 'as-is') {
        const name = mapping?.sourceField?.name;
        if (!name) throw new Error('as-is mapping has no source field');
        return { kind: 'field', path: name };
    }

    if (type === 'constant') {
        return { kind: 'const', value: mapping?.constantValue ?? null };
    }

    if (type === 'expression') {
        if (!mapping?.transformationRule) throw new Error('expression mapping has no transformation rule');
        return dslToTree(mapping.transformationRule);
    }

    throw new Error(`Unknown mapping type "${type}"`);
}

export default {
    validateTransform,
    evaluateTransform,
    collectTransformFields,
    toCellValue,
    mappingToTree,
    astToTree,
    dslToTree,
    treeToDsl,
    FUNCTIONS,
};
