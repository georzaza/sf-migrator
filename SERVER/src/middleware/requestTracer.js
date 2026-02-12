/**
 * Request Tracer Middleware
 *
 * Generates a unique request ID for each incoming request and stores it
 * in AsyncLocalStorage so the logger can include it automatically.
 *
 * The frontend can send X-Request-ID to trace requests end-to-end.
 * The response always includes X-Request-ID for client-side correlation.
 */

const crypto = require('crypto');
const { asyncLocalStorage } = require('../lib/logger');

function requestTracer(req, res, next) {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID().slice(0, 8);
    const action = req.headers.action || '-';
    const orgId = req.body.orgId || '-';

    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    asyncLocalStorage.run({ requestId, action, orgId }, () => {
        next();
    });
}

module.exports = requestTracer;
