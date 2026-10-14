/**
 * Expression parser — compiles a human-written transform formula into the
 * canonical transform tree (see utils/transformTree.js). This is the power-user
 * "Tier 2" input surface: one formula string maps to a tree the whole pipeline
 * already understands.
 *
 * Grammar (precedence low -> high):
 *   comparison  := concat ( ('=' | '!=' | '<' | '<=' | '>' | '>=') concat )?
 *   concat      := additive ( '||' additive )*
 *   additive    := multiplicative ( ('+' | '-') multiplicative )*
 *   multiplicative := unary ( ('*' | '/') unary )*
 *   unary       := '-'? primary
 *   primary     := NUMBER | STRING
 *                | '{' fieldPath '}'          (braced field reference)
 *                | fieldPath                  (bare dotted field reference)
 *                | 'IF' '(' expr ',' expr ',' expr ')'
 *                | 'COALESCE' '(' expr (',' expr)* ')'
 *                | FUNC '(' (expr (',' expr)*)? ')'
 *                | '(' expr ')'
 *   fieldPath   := IDENT ('.' IDENT)*
 *
 * Field references may be written bare (Account.Name) or braced ({Account.Name}).
 * Function names are matched case-insensitively against the transformTree
 * function table; IF and COALESCE are keywords.
 */

import { FUNCTIONS } from './transformTree.js';

const COMPARE_OPS = ['=', '!=', '<', '<=', '>', '>='];

function tokenize(input) {
    const tokens = [];
    let i = 0;
    const n = input.length;

    while (i < n) {
        const ch = input[i];

        if (/\s/.test(ch)) { i += 1; continue; }

        if (input.startsWith('||', i)) { tokens.push({ type: 'CONCAT' }); i += 2; continue; }

        // Two-char comparison operators first.
        if (input.startsWith('!=', i)) { tokens.push({ type: 'OP', value: '!=' }); i += 2; continue; }
        if (input.startsWith('<=', i)) { tokens.push({ type: 'OP', value: '<=' }); i += 2; continue; }
        if (input.startsWith('>=', i)) { tokens.push({ type: 'OP', value: '>=' }); i += 2; continue; }

        if ('+-*/=<>'.includes(ch)) { tokens.push({ type: 'OP', value: ch }); i += 1; continue; }
        if (ch === '(' || ch === ')' || ch === ',' || ch === '{' || ch === '}') { tokens.push({ type: ch }); i += 1; continue; }

        if (ch === "'" || ch === '"') {
            const m = input.slice(i).match(ch === "'" ? /^'([^']*)'/ : /^"([^"]*)"/);
            if (!m) throw new Error(`Unterminated string literal near: ${input.slice(i, i + 20)}`);
            tokens.push({ type: 'STRING', value: m[1] });
            i += m[0].length;
            continue;
        }

        const num = input.slice(i).match(/^\d+(?:\.\d+)?/);
        if (num) {
            tokens.push({ type: 'NUMBER', value: Number(num[0]) });
            i += num[0].length;
            continue;
        }

        // Dotted identifier (field path or function/keyword name).
        const ident = input.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/);
        if (ident) {
            tokens.push({ type: 'IDENT', value: ident[0] });
            i += ident[0].length;
            continue;
        }

        throw new Error(`Unexpected character near: ${input.slice(i, i + 20)}`);
    }

    return tokens;
}

function parseComparison(ts, st) {
    const left = parseConcat(ts, st);
    const tok = ts[st.i];
    if (tok && tok.type === 'OP' && COMPARE_OPS.includes(tok.value)) {
        st.i += 1;
        const right = parseConcat(ts, st);
        return { kind: 'compare', op: tok.value, left, right };
    }
    return left;
}

function parseConcat(ts, st) {
    const parts = [parseAdditive(ts, st)];
    while (ts[st.i] && ts[st.i].type === 'CONCAT') {
        st.i += 1;
        parts.push(parseAdditive(ts, st));
    }
    return parts.length === 1 ? parts[0] : { kind: 'concat', parts };
}

function parseAdditive(ts, st) {
    let left = parseMultiplicative(ts, st);
    while (ts[st.i] && ts[st.i].type === 'OP' && (ts[st.i].value === '+' || ts[st.i].value === '-')) {
        const op = ts[st.i].value;
        st.i += 1;
        const right = parseMultiplicative(ts, st);
        left = { kind: 'binop', op, left, right };
    }
    return left;
}

function parseMultiplicative(ts, st) {
    let left = parseUnary(ts, st);
    while (ts[st.i] && ts[st.i].type === 'OP' && (ts[st.i].value === '*' || ts[st.i].value === '/')) {
        const op = ts[st.i].value;
        st.i += 1;
        const right = parseUnary(ts, st);
        left = { kind: 'binop', op, left, right };
    }
    return left;
}

function parseUnary(ts, st) {
    if (ts[st.i] && ts[st.i].type === 'OP' && ts[st.i].value === '-') {
        st.i += 1;
        const operand = parsePrimary(ts, st);
        return { kind: 'binop', op: '-', left: { kind: 'const', value: 0 }, right: operand };
    }
    return parsePrimary(ts, st);
}

function expect(ts, st, type) {
    const tok = ts[st.i];
    if (!tok || tok.type !== type) {
        throw new Error(`Expected ${type} but found ${tok ? tok.type : 'end of input'}`);
    }
    st.i += 1;
    return tok;
}

function parseArgs(ts, st) {
    const args = [];
    expect(ts, st, '(');
    if (ts[st.i] && ts[st.i].type !== ')') {
        args.push(parseComparison(ts, st));
        while (ts[st.i] && ts[st.i].type === ',') {
            st.i += 1;
            args.push(parseComparison(ts, st));
        }
    }
    expect(ts, st, ')');
    return args;
}

function parsePrimary(ts, st) {
    const tok = ts[st.i];
    if (!tok) throw new Error('Unexpected end of expression');

    if (tok.type === 'NUMBER') { st.i += 1; return { kind: 'const', value: tok.value }; }
    if (tok.type === 'STRING') { st.i += 1; return { kind: 'const', value: tok.value }; }

    if (tok.type === '(') {
        st.i += 1;
        const inner = parseComparison(ts, st);
        expect(ts, st, ')');
        return inner;
    }

    if (tok.type === '{') {
        st.i += 1;
        const path = expect(ts, st, 'IDENT').value;
        expect(ts, st, '}');
        return { kind: 'field', path };
    }

    if (tok.type === 'IDENT') {
        const name = tok.value;
        const upper = name.toUpperCase();
        const next = ts[st.i + 1];

        // Function / keyword call — only when immediately followed by '('.
        if (next && next.type === '(') {
            st.i += 1; // consume the name
            if (upper === 'IF') {
                const args = parseArgs(ts, st);
                if (args.length !== 3) throw new Error('IF expects exactly 3 arguments: IF(cond, then, else)');
                return { kind: 'if', cond: args[0], then: args[1], else: args[2] };
            }
            if (upper === 'COALESCE') {
                const args = parseArgs(ts, st);
                if (args.length === 0) throw new Error('COALESCE expects at least 1 argument');
                return { kind: 'coalesce', args };
            }
            if (FUNCTIONS[upper]) {
                const args = parseArgs(ts, st);
                return { kind: 'func', name: upper, args };
            }
            throw new Error(`Unknown function: ${name}`);
        }

        // Otherwise a bare (possibly dotted) field reference.
        st.i += 1;
        return { kind: 'field', path: name };
    }

    throw new Error(`Unexpected token "${tok.type}" in expression`);
}

/**
 * Compile a formula string into a transform tree. Throws on syntax errors.
 */
export function parseExpressionToTree(formula) {
    if (!formula || typeof formula !== 'string' || !formula.trim()) {
        throw new Error('Expression must be a non-empty string');
    }
    const tokens = tokenize(formula.trim());
    if (tokens.length === 0) {
        throw new Error('Expression is empty');
    }
    const st = { i: 0 };
    const tree = parseComparison(tokens, st);
    if (st.i !== tokens.length) {
        throw new Error('Unexpected trailing tokens in expression');
    }
    return tree;
}

export default { parseExpressionToTree };
