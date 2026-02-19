/**
 * Salesforce Service
 *
 * Handles connections to Salesforce orgs and metadata retrieval using jsforce.
 * Uses OAuth2 Username-Password flow (JSFORCE_REFERENCE.md Pattern 2).
 */

const jsforce = require('jsforce');
const fetch = require('node-fetch');
const orgRepo = require('../repositories/orgRepository');
const logger = require('../lib/logger');
const log = logger.create('salesforceService');
const plimit = require('p-limit');
const express = require('express');
const router = express.Router();

const connectionPool = new Map();
const oauth2Map = new Map();

const VERSION = '65.0';
const BATCH_COMPOSITE_API_REQUESTS_SIZE = 25;

/**
 * Thrown by connectToOrg when the org has not been authorized yet.
 * API routes catch this and return 401 { authUrl } so the frontend
 * can redirect the browser to start the OAuth2 flow.
 */
class OAuthRequiredError extends Error {
    constructor(sfOrgId) {
        super('Org is not authenticated');
        this.name = 'OAuthRequiredError';
        this.sfOrgId = sfOrgId;
        this.authUrl = `/oauth2/auth?sfOrgId=${sfOrgId}`;
    }
}

/**
 * Step 1 – redirect the browser to the Salesforce authorization page.
 * Query params:
 *   sfOrgId  – which org to authenticate
 *   returnTo – (optional) frontend URL to return to after auth completes
 */
router.get('/oauth2/auth', async (req, res) => {
    const { sfOrgId, returnTo } = req.query;
    if (!sfOrgId) return res.status(400).json({ error: 'sfOrgId is required' });

    const sfOrg = await orgRepo.findById(sfOrgId);
    if (!sfOrg) return res.status(404).json({ error: 'Org not found' });

    const oauth2 = new jsforce.OAuth2({
        loginUrl: sfOrg.loginURL,
        clientId: sfOrg.clientId,
        clientSecret: sfOrg.clientSecret,
        redirectUri: process.env.SF_REDIRECT_URI,
    });
    oauth2Map.set(sfOrgId, oauth2);

    const state = JSON.stringify({ sfOrgId, returnTo: returnTo || '' });
    res.redirect(oauth2.getAuthorizationUrl({ scope: 'full', state }));
});

/**
 * Step 2 – Salesforce calls back here with an authorization code.
 * Exchange it for tokens and store the connection in the pool.
 */
router.get('/oauth2/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state)
        return res.status(400).json({ error: 'Missing code or state' });

    let sfOrgId, returnTo;
    try {
        ({ sfOrgId, returnTo } = JSON.parse(state));
    } catch {
        return res.status(400).json({ error: 'Invalid state parameter' });
    }

    const oauth2 = oauth2Map.get(sfOrgId);
    if (!oauth2)
        return res.status(400).json({ error: 'No pending auth session for this org' });

    try {
        const conn = new jsforce.Connection({ oauth2, version: VERSION });
        const userInfo = await conn.authorize(code);

        connectionPool.set(sfOrgId, conn);
        oauth2Map.delete(sfOrgId);

        log.info('OAuth2 authorized', { sfOrgId, userId: userInfo.id, orgId: userInfo.organizationId });

        const redirectTo = returnTo || (process.env.FRONTEND_URL || 'http://localhost:5173');
        res.redirect(redirectTo);
    } catch (error) {
        log.error('OAuth2 callback failed', error, { sfOrgId });
        oauth2Map.delete(sfOrgId);
        res.status(500).json({ error: error.message });
    }
});


async function connectToOrg(sfOrgId) {
    if (connectionPool.has(sfOrgId)) {
        const conn = connectionPool.get(sfOrgId);
        try {
            await conn.identity();
            return conn;
        } catch {
            log.warn('Cached connection invalid, removing', { sfOrgId });
            connectionPool.delete(sfOrgId);
        }
    }

    // No valid connection – the frontend must redirect the browser to /oauth2/auth first
    throw new OAuthRequiredError(sfOrgId);
}


async function describeGlobal(sfOrgId) {
    const conn = await connectToOrg(sfOrgId);

    try {
        const describeResult = await conn.describeGlobal();
        log.info('Issuing describe global', {orgId: sfOrgId})

        const objects = describeResult.sobjects
            .filter(() => true)
            .map(obj => ({
                objectName: obj.name,
                objectLabel: obj.label,
                isCustom: obj.custom,
            }));

        log.toFile('describeGlobal', objects);
        return objects;
    } catch (error) {
        log.error('Failed to analyze org', error, { sfOrgId });
        throw new Error(`Failed to analyze org: ${error.message}`);
    }
}

/**
 * Uses Composite API
 * https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/requests_composite.htm
 *
 * Salesforce Developer Edition & Trial orgs have a limit of 5 concurrent requests.
 * (For Production orgs and Sandboxes the limit is 25).
 *
 * Each composite API request counts as 1 request.
 * In each request, we can group up to 25 separate requests.
 *
 * That will be a 125% increase in performance against a serial request approach.
 */

async function describeObjectMultiple(sfOrgId, objectNames) {
    const conn = await connectToOrg(sfOrgId);

    const compositeRequests = [];

    // Build the requests
    for (let i = 0; i < objectNames.length; i += BATCH_COMPOSITE_API_REQUESTS_SIZE) {
        const chunk = objectNames.slice(i, i + BATCH_COMPOSITE_API_REQUESTS_SIZE);
        const subrequests = chunk.map(name => ({
            method: 'GET',
            url: `/services/data/v${conn.version}/sobjects/${name}/describe`,
            referenceId: `ref${name}Describe`,
        }));
        const body = {
            allOrNone: true,
            collateSubrequests: true,
            compositeRequest: subrequests,
        };
        console.log(body);
        compositeRequests.push(JSON.stringify(body));
    }

    // TODO p-limit & get describes for all objects.
    const response = await conn.request({
        method: 'POST',
        url: `/services/data/v${conn.version}/composite`,
        headers: {
            //'Authorization': `Bearer ${conn.accessToken}`, // jsforce should handle this, if not we can add explicitly
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: compositeRequests[0],
    });
}

// Callers should consider sf API limits before invoking in loops, use describeObjectMultiple instead if applicable.
async function describeObject(sfOrgId, objectName) {
    const conn = await connectToOrg(sfOrgId);

    try {
        const describeResult = await conn.sobject(objectName).describe();

        return {
            objectName: describeResult.name,
            objectLabel: describeResult.label,
            isCustom: describeResult.custom,
            fields: describeResult.fields.map(field => ({
                fieldName: field.name,
                fieldLabel: field.label,
                dataType: field.type,
                length: field.length,
                isRequired: !field.nillable,
                isCustom: field.custom,
                picklistValues: field.picklistValues
                    ? field.picklistValues.map(p => ({ label: p.label, value: p.value }))
                    : null,
            })),
        };
    } catch (error) {
        log.error('Failed to get object metadata', error, { sfOrgId, objectName });
        throw new Error(`Failed to get object metadata: ${error.message}`);
    }
}


async function getRecordCount(sfOrgId, objectName) {
    const conn = await connectToOrg(sfOrgId);

    try {
        const result = await conn.query(`SELECT COUNT() FROM ${objectName}`);
        return result.totalSize;
    } catch (error) {
        log.error('Failed to get record count', error, { sfOrgId, objectName });
        return null;
    }
}


async function queryRecords(sfOrgId, soql) {
    const conn = await connectToOrg(sfOrgId);

    try {
        const result = await conn.query(soql);
        return result.records;
    } catch (error) {
        log.error('SOQL query failed', error, { sfOrgId, soql });
        throw new Error(`Query failed: ${error.message}`);
    }
}

/**
 * Insert records into Salesforce using Bulk API (>200) or standard API
 */
async function insertRecords(sfOrgId, objectName, records) {
    const conn = await connectToOrg(sfOrgId);

    try {
        if (records.length > 200) {
            const job = conn.bulk.createJob(objectName, 'insert');
            const batch = job.createBatch();
            batch.execute(records);

            return new Promise((resolve, reject) => {
                batch.on('response', resolve);
                batch.on('error', reject);
            });
        } else {
            return conn.sobject(objectName).create(records);
        }
    } catch (error) {
        log.error('Record insert failed', error, { sfOrgId, objectName, recordCount: records.length });
        throw new Error(`Insert failed: ${error.message}`);
    }
}


function clearConnection(sfOrgId) {
    connectionPool.delete(sfOrgId);
    log.info('Cleared cached connection', { sfOrgId });
}


async function testConnection(sfOrgId) {
    const conn = await connectToOrg(sfOrgId);

    try {
        const identity = await conn.identity();
        return {
            userId: identity.user_id,
            username: identity.username,
            orgId: identity.organization_id,
            displayName: identity.display_name,
        };
    } catch (error) {
        log.error('Connection test failed', error, { sfOrgId });
        throw new Error(`Connection test failed: ${error.message}`);
    }
}

module.exports = {
    router,
    OAuthRequiredError,
    connectToOrg,
    clearConnection,
    describeGlobal,
    describeObject,
    getRecordCount,
    queryRecords,
    insertRecords,
    testConnection,
    describeObjectMultiple,
};
