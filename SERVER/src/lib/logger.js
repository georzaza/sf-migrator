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
const fs = require('fs');
const path = require('path');

const asyncLocalStorage = new AsyncLocalStorage();

const LOG_LEVEL_DEBUG = 'DEBUG';
const LOG_LEVEL_ERROR = 'ERROR';
const LOG_LEVEL_INFO  = 'INFO';
const LOG_LEVEL_TODISK= 'TODISK';
const LOG_LEVEL_WARN  = 'WARN';


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
        orgId: store?.orgId || '-'
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
    let header = `$[${ts}]`
    header += `[${level}]`;
    header += `[${caller}]`;
    header += `[req:${ctx.requestId}]`
    header += `${ctx.action !== '-' ? ` [action:${ctx.action}]` : ''}`;
    header += `${ctx.orgId !== '-' ? ` [org:${ctx.orgId}]` : ''}`;

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
 * @returns {{ debug, info, warn, error, toFile }}
 */
function create(callerName) {
    return {
        debug(message, meta = undefined) {
            console.debug(formatLine(LOG_LEVEL_DEBUG, callerName, message, meta));
            console.debug('');
        },

        info(message, meta = undefined) {
            console.info(formatLine(LOG_LEVEL_INFO, callerName, message, meta));
            console.info();
        },

        warn(message, meta = undefined) {
            console.warn(formatLine(LOG_LEVEL_WARN, callerName, message, meta));
            console.warn('');
        },

        /**
         * @param {string} message - What failed
         * @param {Error|any} error - Full error object (serialized automatically)
         * @param {Object} [meta] - Additional context
         */
        error(message, error, meta = undefined) {
            const enriched = { ...(meta || {}), error: serializeError(error) };
            console.error(formatLine(LOG_LEVEL_ERROR, callerName, message, enriched));
            console.error('');
        },

        // writes log to ../../logs/YYYYMMDD, will be handy for debugging sf svc.
        toFile(message, meta = undefined) {
            const ts = getTimestamp();
            const ctx = getRequestContext();
            const sanitizedTs = ts.replace(/:/g, '-');
            const dateStr = ts.substring(0, 10).replace(/-/g, '');
            const filename = `${sanitizedTs}_${callerName}_${ctx.action}_${ctx.orgId}_${ctx.requestId}.log`;
            const logDir = path.join(__dirname, '../../logs', dateStr);
            const logPath = path.join(logDir, filename);

            // Ensure logs directory exists
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            const formatted = formatLine(LOG_LEVEL_TODISK, callerName, meta);
            fs.appendFileSync(logPath, formatted);
            // Log that the file was written
            this.info(`Log created: ${filename}`, { logPath, dateFolder: dateStr });
        },
    };
}

module.exports = {
    create,
    asyncLocalStorage,
    getRequestContext,
};
