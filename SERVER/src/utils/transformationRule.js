/**
 * Transformation rule parser/evaluator for field mapping expressions.
 * Supported syntax:
 *   {Object.Field}
 *   {Object.Relationship.Field}            (relationship traversal)
 *   {Object.Field1 || Object.Field2}
 *   {'PREFIX-' || Object.Field || '-SUFFIX'} (string literals)
 *   {SUBSTR(Object.Field, 2, 5)}
 *   nested combinations of the above.
 */

function tokenize(input) {
    const tokens = [];
    let i = 0;

    while (i < input.length) {
        const ch = input[i];

        if (/\s/.test(ch)) {
            i += 1;
            continue;
        }

        if (input.startsWith('||', i)) {
            tokens.push({ type: 'CONCAT' });
            i += 2;
            continue;
        }

        if (ch === '(' || ch === ')' || ch === ',') {
            tokens.push({ type: ch });
            i += 1;
            continue;
        }

        // String literal: single- or double-quoted, no escape sequences.
        if (ch === "'" || ch === '"') {
            const stringMatch = input.slice(i).match(ch === "'" ? /^'([^']*)'/ : /^"([^"]*)"/);
            if (!stringMatch) {
                throw new Error(`Unterminated string literal near: ${input.slice(i, i + 20)}`);
            }
            tokens.push({ type: 'STRING', value: stringMatch[1] });
            i += stringMatch[0].length;
            continue;
        }

        const substrMatch = input.slice(i).match(/^SUBSTR\b/i);
        if (substrMatch) {
            tokens.push({ type: 'SUBSTR' });
            i += substrMatch[0].length;
            continue;
        }

        const numberMatch = input.slice(i).match(/^\d+/);
        if (numberMatch) {
            tokens.push({ type: 'NUMBER', value: Number.parseInt(numberMatch[0], 10) });
            i += numberMatch[0].length;
            continue;
        }

        // Field reference: Object.Field or Object.Relationship.Field (one or more dotted segments).
        const fieldRefMatch = input.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+/);
        if (fieldRefMatch) {
            tokens.push({ type: 'FIELD_REF', value: fieldRefMatch[0] });
            i += fieldRefMatch[0].length;
            continue;
        }

        throw new Error(`Unexpected token near: ${input.slice(i, i + 20)}`);
    }

    return tokens;
}

function parseExpression(tokens, state) {
    const parts = [parsePrimary(tokens, state)];

    while (tokens[state.index] && tokens[state.index].type === 'CONCAT') {
        state.index += 1;
        parts.push(parsePrimary(tokens, state));
    }

    if (parts.length === 1) {
        return parts[0];
    }

    return { type: 'concat', parts };
}

function parsePrimary(tokens, state) {
    const token = tokens[state.index];
    if (!token) {
        throw new Error('Unexpected end of expression');
    }

    if (token.type === 'FIELD_REF') {
        state.index += 1;
        return { type: 'fieldRef', value: token.value };
    }

    if (token.type === 'STRING') {
        state.index += 1;
        return { type: 'literal', value: token.value };
    }

    if (token.type === 'SUBSTR') {
        state.index += 1;
        expect(tokens, state, '(');
        const value = parseExpression(tokens, state);
        expect(tokens, state, ',');
        const start = expect(tokens, state, 'NUMBER').value;
        expect(tokens, state, ',');
        const end = expect(tokens, state, 'NUMBER').value;
        expect(tokens, state, ')');
        return { type: 'substr', value, start, end };
    }

    throw new Error(`Expected field reference or SUBSTR but found ${token.type}`);
}

function expect(tokens, state, type) {
    const token = tokens[state.index];
    if (!token || token.type !== type) {
        throw new Error(`Expected ${type} but found ${token ? token.type : 'end of input'}`);
    }
    state.index += 1;
    return token;
}

export function parseTransformationRule(rule) {
    if (!rule || typeof rule !== 'string') {
        throw new Error('Transformation rule must be a non-empty string');
    }

    const trimmed = rule.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
        throw new Error('Transformation rule must start with { and end with }');
    }

    const inner = trimmed.slice(1, -1).trim();
    if (!inner) {
        throw new Error('Transformation rule cannot be empty');
    }

    const tokens = tokenize(inner);
    const state = { index: 0 };
    const ast = parseExpression(tokens, state);

    if (state.index !== tokens.length) {
        throw new Error('Invalid trailing tokens in transformation rule');
    }

    return ast;
}

export function extractReferencedFields(ast, fields = new Set()) {
    if (!ast) return fields;

    if (ast.type === 'fieldRef') {
        fields.add(ast.value);
        return fields;
    }

    if (ast.type === 'concat') {
        for (const part of ast.parts) {
            extractReferencedFields(part, fields);
        }
        return fields;
    }

    if (ast.type === 'substr') {
        extractReferencedFields(ast.value, fields);
    }

    return fields;
}

function getFieldValue(sourceRecord, ref) {
    // First segment is the object/relationship root; the remainder is the path
    // into the (possibly nested) source record.
    const segments = ref.split('.');
    const path = segments.slice(1);

    let current = sourceRecord;
    for (const seg of path) {
        if (current === null || current === undefined) break;
        current = current[seg];
    }

    // Fallback for flattened records: try the dotted remainder or the leaf name
    // as a flat column key (e.g. "Owner.Name" or "Name").
    if (current === null || current === undefined) {
        const flatKey = path.join('.');
        const leafKey = path[path.length - 1];
        current = sourceRecord?.[flatKey] ?? sourceRecord?.[leafKey];
    }

    return current === null || current === undefined ? '' : String(current);
}

function evaluateAst(ast, sourceRecord) {
    if (ast.type === 'fieldRef') {
        return getFieldValue(sourceRecord, ast.value);
    }

    if (ast.type === 'literal') {
        return ast.value;
    }

    if (ast.type === 'concat') {
        return ast.parts.map(part => evaluateAst(part, sourceRecord)).join('');
    }

    if (ast.type === 'substr') {
        const value = evaluateAst(ast.value, sourceRecord);
        const start = Math.max(ast.start - 1, 0);
        const length = Math.max(ast.end - ast.start + 1, 0);
        return value.substring(start, start + length);
    }

    return '';
}

export function evaluateTransformationRule(rule, sourceRecord) {
    const ast = typeof rule === 'string' ? parseTransformationRule(rule) : rule;
    return evaluateAst(ast, sourceRecord);
}
