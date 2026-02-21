/**
 * OAuth2 Routes
 *
 * Handles the two-leg Salesforce OAuth2 flow:
 *   GET /oauth2/auth     — builds the auth URL and redirects the popup to Salesforce
 *   GET /oauth2/callback — receives the code/error from Salesforce and postMessages the result back
 */

const express = require('express');
const router = express.Router();
const sfService = require('../services/salesforceService');
const probeUrl = require('../utils/probeUrl');
const popupResultHtml = require('../utils/popupResultHtml');
const logger = require('../lib/logger');
const log = logger.create('oauthRoutes');

/**
 * Step 1 — Validate the org URL, then redirect the popup window to Salesforce for authorization.
 */
router.get('/oauth2/auth', async (req, res) => {
    const { sfOrgId, returnTo } = req.query;
    if (!sfOrgId) return res.status(400).json({ error: 'sfOrgId is required' });

    try {
        const { loginURL, authorizationUrl } = await sfService.beginOAuth(sfOrgId, returnTo);

        // Probe the loginURL before redirecting so we return a meaningful error
        // rather than sending the user to a broken Salesforce page.
        const reachable = await probeUrl(loginURL);
        if (!reachable) {
            const message = `Cannot reach org login URL: ${loginURL}. Please verify the URL is correct`;
            const fallback = returnTo || (process.env.FRONTEND_URL || 'http://localhost:5173');
            sfService.cancelOAuth(sfOrgId);
            return res.send(popupResultHtml({ type: 'sf-oauth-error', message }, fallback));
        }

        res.redirect(authorizationUrl);
    } catch (err) {
        const status = err.status ?? 500;
        log.error('OAuth2 auth failed', err, { sfOrgId });
        res.status(status).json({ error: err.message });
    }
});

/**
 * Step 2 — Salesforce redirects back here with a code (success) or error query params.
 * Responds with a tiny HTML page that postMessages the result to the opener window.
 * Falls back to a plain redirect when not running in a popup.
 *
 * Note: redirect_uri_mismatch errors never reach this callback — Salesforce shows them on
 * its own page. The frontend detects that case by polling for popup closure without a postMessage.
 */
router.get('/oauth2/callback', async (req, res) => {
    const { code, state, error, error_description } = req.query;
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

    // Parse state — needed for the returnTo fallback in all paths.
    let sfOrgId, returnTo;
    if (state) {
        try { ({ sfOrgId, returnTo } = JSON.parse(state)); } catch { /* state malformed, handled below */ }
    }
    const fallbackBase = returnTo || frontendUrl;

    // Salesforce returned an error (access_denied, invalid_scope, etc.).
    if (error) {
        const message = error_description
            ? decodeURIComponent(error_description)
            : (error || 'Salesforce authorization failed');
        log.warn('OAuth2 Salesforce error', { error, error_description, sfOrgId });
        if (sfOrgId) sfService.cancelOAuth(sfOrgId);
        const errFallback = new URL(fallbackBase);
        errFallback.searchParams.set('oauthError', message);
        return res.send(popupResultHtml({ type: 'sf-oauth-error', message }, errFallback.toString()));
    }

    if (!code || !state || !sfOrgId)
        return res.status(400).json({ error: 'Missing code or state' });

    try {
        const userInfo = await sfService.completeOAuth(sfOrgId, code);
        log.info('OAuth2 callback complete', { sfOrgId, userId: userInfo?.id });
        return res.send(popupResultHtml({ type: 'sf-oauth-success', sfOrgId }, fallbackBase));
    } catch (err) {
        log.error('OAuth2 callback failed', err, { sfOrgId });
        const message = err.message || 'Authorization failed';
        const errFallback = new URL(fallbackBase);
        errFallback.searchParams.set('oauthError', message);
        return res.send(popupResultHtml({ type: 'sf-oauth-error', message }, errFallback.toString()));
    }
});

module.exports = router;
