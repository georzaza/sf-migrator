/**
 * Salesforce Service
 *
 * Handles connections to Salesforce orgs and metadata retrieval using jsforce.
 * Uses OAuth2 Username-Password flow (JSFORCE_REFERENCE.md Pattern 2).
 */

import jsforce from 'jsforce';
import orgRepo from '../repositories/orgRepository.js';
import logger from '../lib/logger.js';
const log = logger.create('salesforceService');
import { mapSfField } from '../utils/sfFieldMapper.js';
import { mapSfObject } from '../utils/sfObjectMapper.js';

const VERSION = '65.0';

const connectionPool = new Map();
const oauth2Map = new Map();

// Inline concurrency limiter instead of p-limit which is ESM-only in v5+)
const pLimit = (concurrency) => {
    let active = 0;
    const queue = [];
    const next = () => {
        if (active >= concurrency || queue.length === 0) return;
        active++;
        const { fn, resolve, reject } = queue.shift();
        fn().then(resolve, reject).finally(() => { active--; next(); });
    };
    return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}

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
 * Step 1 — Build and store the OAuth2 session, return the Salesforce authorization URL.
 * Throws with status 404 if the org is not found.
 */
async function beginOAuth(sfOrgId, returnTo) {
    const sfOrg = await orgRepo.findById(sfOrgId);
    if (!sfOrg) throw Object.assign(new Error('Org not found'), { status: 404 });

    const oauth2 = new jsforce.OAuth2({
        loginUrl: sfOrg.loginURL,
        clientId: sfOrg.clientId,
        clientSecret: sfOrg.clientSecret,
        redirectUri: process.env.SF_REDIRECT_URI,
        useVerifier: true
    });
    oauth2Map.set(sfOrgId, oauth2);

    const state = JSON.stringify({ sfOrgId, returnTo: returnTo || '' });
    return {
        loginURL: sfOrg.loginURL,
        authorizationUrl: oauth2.getAuthorizationUrl({ scope: 'full refresh_token', state }),
    };
}

/**
 * Step 2 — Exchange the authorization code for a connection and store it in the pool.
 * Throws if there is no pending session or jsforce throws during authorization.
 * Cleans up oauth2Map in all cases.
 */
async function completeOAuth(sfOrgId, code) {
    const oauth2 = oauth2Map.get(sfOrgId);
    if (!oauth2) throw Object.assign(new Error('No pending auth session for this org'), { status: 400 });

    try {
        const conn = new jsforce.Connection({ oauth2, version: VERSION });
        const userInfo = await conn.authorize(code);
        connectionPool.set(sfOrgId, conn);
        oauth2Map.delete(sfOrgId);

        // Preserve an existing completed analysis across re-login. Only reset to
        // 'idle' for orgs that have not been analyzed yet, so re-authenticating
        // (e.g. to refresh tokens) does not force a full re-analysis.
        const existingOrg = await orgRepo.findById(sfOrgId).catch(() => null);
        const shouldResetAnalysisStatus = existingOrg?.analysisStatus !== 'complete';

        await orgRepo.update(sfOrgId, {
            accessToken: conn.accessToken,
            refreshToken: conn.refreshToken,
            instanceUrl: conn.instanceUrl
        }).catch(() => {});
        if (shouldResetAnalysisStatus) {
            await orgRepo.updateAnalysisStatus(sfOrgId, 'idle').catch(() => {});
        }
        log.info('OAuth2 authorized', { sfOrgId, userId: userInfo.id, organizationId: userInfo.organizationId });
        return userInfo;
    } catch (err) {
        oauth2Map.delete(sfOrgId);
        throw err;
    }
}


/**
 * Discard a pending OAuth session without completing it (e.g. on probe failure before redirect).
 */
function cancelOAuth(sfOrgId) {
    oauth2Map.delete(sfOrgId);
}


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
    throw new OAuthRequiredError(sfOrgId);
}


async function describeGlobal(sfOrgId) {
    const conn = await connectToOrg(sfOrgId);
    try {
        const describeResult = await conn.describeGlobal();
        log.info('Issuing describe global', {orgId: sfOrgId})

        const objects = describeResult.sobjects
            .filter(() => true)
            .map(mapSfObject);

        log.toFile('describeGlobal', objects);
        return objects;
    } catch (error) {
        throw error;
    }
}

/**
 * Uses Composite API
 * https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/requests_composite.htm
 *
 * Salesforce Developer Edition & Trial orgs have a limit of 5 concurrent requests.
 * (Production and Sandboxes have a limit of 25)
 *
 * For a Salesforce Developer Edition org, the daily API limits are 15000.
 *
 * Each composite API request counts as 1 request.
 * In each request, we can group up to 25 separate requests.
 *
 * Gains against a serial approach:
 *    - 96% reduction in the number of requests
 *    - Massive performance boost.
 *      10+ minutes for 500 objects would now take 10 seconds.
 *
 */

async function describeObjectMultiple(sfOrgId, objectNames) {
    const conn = await connectToOrg(sfOrgId);
    const BATCH_SIZE = 25;
    const CONCURRENCY = 5;

    // Build one request body per chunk of 25 object names
    const requestBodies = [];
    for (let i = 0; i < objectNames.length; i += BATCH_SIZE) {
        const chunk = objectNames.slice(i, i + BATCH_SIZE);
        requestBodies.push({
            allOrNone: false,
            collateSubrequests: false,
            compositeRequest: chunk.map(name => ({
                method: 'GET',
                url: `/services/data/v${conn.version}/sobjects/${name}/describe`,
                referenceId: `ref${name}`,
            })),
        });
    }

    log.info('describeObjectMultiple is about to start', {
        orgid: sfOrgId,
        totalObjects: objectNames.length,
        totalRequests: requestBodies.length,
        requestBatchSize: BATCH_SIZE,
        maxConcurrentRequests: CONCURRENCY,
    });

    const limit = pLimit(CONCURRENCY);
    const allResponses = await Promise.all(
        requestBodies.map(body => limit(() =>
            conn.request({
                method: 'POST',
                url: `/services/data/v${conn.version}/composite`,
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify(body),
            })
        ))
    );
    log.toFile('describeObjectMultiple_allResponses', allResponses);

    // Each response has a compositeResponse array; extract and normalize each successful subrequest
    const sobjectDescribes = allResponses.flatMap(response =>
        (response.compositeResponse ?? [])
            .filter(sub => sub.httpStatusCode === 200)
            .map(sub => ({
                ...mapSfObject(sub.body),
                fields: (sub.body.fields ?? []).map(mapSfField),
            }))
    );

    log.info('describeObjectMultiple completed', {describedObjects: sobjectDescribes.length, orgId: sfOrgId });
    return sobjectDescribes;
}

// Consider sf API limits before invoking in loops, use describeObjectMultiple instead if applicable.
async function describeObject(sfOrgId, objectName) {
    const conn = await connectToOrg(sfOrgId);
    try {
        const describeResult = await conn.sobject(objectName).describe();
        return {
            ...mapSfObject(describeResult),
            fields: describeResult.fields.map(mapSfField),
        };
    } catch (error) {
        throw error;
    }
}


async function getRecordCount(sfOrgId, objectName) {
    const conn = await connectToOrg(sfOrgId);

    try {
        const result = await conn.query(`SELECT COUNT() FROM ${objectName}`);
        return result.totalSize;
    } catch (error) {
        throw new Error('getRecordCount failed', {cause: error, object: objectName});
    }
}


async function queryRecords(sfOrgId, soql) {
    const conn = await connectToOrg(sfOrgId);
    try {
        const result = await conn.query(soql);
        return result.records;
    } catch (error) {
        throw new Error(`Query failed`, { cause: error, query: soql });
    }
}


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
        throw new Error('Insert failed:', { cause: error, sfOrgId, objectName, recordCount: records.length });
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
        throw error;
    }
}

export default {
    OAuthRequiredError,
    beginOAuth,
    completeOAuth,
    cancelOAuth,
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
