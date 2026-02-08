/**
 * Structured Logger
 *
 * Provides:
 * - Caller identification (module name per logger instance)
 * - Request tracing via AsyncLocalStorage (requestId + action)
 * - Full error object serialization (not just message)
 *
 * Usage:
 *   const logger = require('../lib/logger');
 *   const log = logger.create('myModule');
 *
 *   log.info('Something happened', { key: 'value' });
 *   log.error('Something failed', error, { orgId: '...' });
 */

const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

function getTimestamp() {
    return new Date().toISOString();
}

/**
 * Get the current request context from AsyncLocalStorage.
 * Returns { requestId, action } or defaults if outside a request.
 */
function getRequestContext() {
    const store = asyncLocalStorage.getStore();
    return {
        requestId: store?.requestId || '-',
        action: store?.action || '-',
    };
}

/**
 * Serialize an Error object into a plain object with all properties.
 * Captures name, message, stack, and any extra fields (code, errorCode, etc.)
 * Also captures prototype properties that might contain error details (like jsforce errors)
 */
function serializeError(error) {
    if (!error) return undefined;
    if (error instanceof Error) {
        const serialized = {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };

        // Get all own properties (including non-enumerable)
        for (const key of Object.getOwnPropertyNames(error)) {
            if (!serialized[key]) {
                serialized[key] = error[key];
            }
        }

        // Get all enumerable properties (including from prototype chain)
        // This captures properties like 'error', 'error_description' from jsforce errors
        for (const key in error) {
            if (!serialized[key]) {
                try {
                    serialized[key] = error[key];
                } catch (e) {
                    // Skip properties that throw on access
                }
            }
        }

        // Recursively serialize nested error objects
        if (serialized.error && typeof serialized.error === 'object') {
            serialized.error = serializeError(serialized.error);
        }

        return serialized;
    }
    return error;
}

function formatLine(level, caller, message, meta) {
    const ts = getTimestamp();
    const ctx = getRequestContext();

    // Build header line with timestamp, level, caller, and context
    const header = `[${ts}] [${level}] [${caller}] [req:${ctx.requestId}]${ctx.action !== '-' ? ` [action:${ctx.action}]` : ''}`;

    // Start with header and message
    let output = `${header}\n  ${message}`;

    // Add metadata if present, formatted with indentation for readability
    if (meta && Object.keys(meta).length > 0) {
        output += '\n  Metadata:';

        // Handle error separately for better formatting
        if (meta.error) {
            const error = meta.error;
            output += `\n    Error: ${error.name || 'Error'}: ${error.message || '(no message)'}`;

            if (error.stack) {
                output += '\n    Stack Trace:';
                const stackLines = error.stack.split('\n');
                stackLines.forEach(line => {
                    output += `\n      ${line}`;
                });
            }

            // Show other error properties
            const errorKeys = Object.keys(error).filter(k => k !== 'name' && k !== 'message' && k !== 'stack');
            if (errorKeys.length > 0) {
                output += '\n    Additional Error Properties:';
                errorKeys.forEach(key => {
                    const value = typeof error[key] === 'object'
                        ? JSON.stringify(error[key], null, 2).split('\n').join('\n      ')
                        : error[key];
                    output += `\n      ${key}: ${value}`;
                });
            }

            // Show other metadata (excluding error)
            const otherMeta = { ...meta };
            delete otherMeta.error;
            if (Object.keys(otherMeta).length > 0) {
                output += '\n    Context:';
                output += '\n' + JSON.stringify(otherMeta, null, 2).split('\n').map(line => `      ${line}`).join('\n');
            }
        } else {
            // No error, just format metadata nicely
            output += '\n' + JSON.stringify(meta, null, 2).split('\n').map(line => `    ${line}`).join('\n');
        }
    }

    return output;
}

/**
 * Create a logger instance for a specific module/caller.
 * @param {string} callerName - Identifies the module (e.g. 'salesforceService')
 * @returns {{ debug, info, warn, error }}
 */
function create(callerName) {
    return {
        debug(message, meta = undefined) {
            console.debug(formatLine('DEBUG', callerName, message, meta));
            console.debug(''); // Empty line for separation
        },

        info(message, meta = undefined) {
            console.info(formatLine('INFO', callerName, message, meta));
            console.info(''); // Empty line for separation
        },

        warn(message, meta = undefined) {
            console.warn(formatLine('WARN', callerName, message, meta));
            console.warn(''); // Empty line for separation
        },

        /**
         * @param {string} message - What failed
         * @param {Error|any} error - Full error object (serialized automatically)
         * @param {Object} [meta] - Additional context
         */
        error(message, error, meta = undefined) {
            const enriched = { ...(meta || {}), error: serializeError(error) };
            console.error(formatLine('ERROR', callerName, message, enriched));
            console.error(''); // Empty line for separation
        },
    };
}

module.exports = {
    create,
    asyncLocalStorage,
    getRequestContext,
};
