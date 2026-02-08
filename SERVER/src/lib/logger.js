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
 */
function serializeError(error) {
    if (!error) return undefined;
    if (error instanceof Error) {
        const serialized = {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
        for (const key of Object.getOwnPropertyNames(error)) {
            if (!serialized[key]) {
                serialized[key] = error[key];
            }
        }
        return serialized;
    }
    return error;
}

function formatLine(level, caller, message, meta) {
    const ts = getTimestamp();
    const ctx = getRequestContext();
    const parts = [`[${ts}]`, `[${level}]`, `[${caller}]`, `[req:${ctx.requestId}]`];

    if (ctx.action !== '-') {
        parts.push(`[action:${ctx.action}]`);
    }

    parts.push(message);

    if (meta && Object.keys(meta).length > 0) {
        parts.push('|');
        parts.push(JSON.stringify(meta));
    }

    return parts.join(' ');
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
        },

        info(message, meta = undefined) {
            console.info(formatLine('INFO', callerName, message, meta));
        },

        warn(message, meta = undefined) {
            console.warn(formatLine('WARN', callerName, message, meta));
        },

        /**
         * @param {string} message - What failed
         * @param {Error|any} error - Full error object (serialized automatically)
         * @param {Object} [meta] - Additional context
         */
        error(message, error, meta = undefined) {
            const enriched = { ...(meta || {}), error: serializeError(error) };
            console.error(formatLine('ERROR', callerName, message, enriched));
        },
    };
}

module.exports = {
    create,
    asyncLocalStorage,
    getRequestContext,
};
