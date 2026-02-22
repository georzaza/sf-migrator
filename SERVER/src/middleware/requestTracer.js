/**
 * Request Tracer Middleware
 *
 * Generates a unique request ID for each incoming request and stores it
 * in AsyncLocalStorage so the logger can include it automatically.
 *
 * The frontend can send X-Request-ID to trace requests end-to-end.
 * The response always includes X-Request-ID for client-side correlation.
 */

import crypto from 'crypto';
import logger from '../lib/logger.js';

const { asyncLocalStorage } = logger;

function requestTracer(req, res, next) {
    const requestId = req.get('x-request-id') || crypto.randomUUID().slice(0, 8);
    const action = req.get('action') || '-';
    const orgId = req.body.orgId || '-';

    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    asyncLocalStorage.run({ requestId, action, orgId }, () => {
        next();
    });
}

export default requestTracer;
