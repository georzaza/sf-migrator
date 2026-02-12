/**
 * Salesforce Service
 *
 * Handles connections to Salesforce orgs and metadata retrieval using jsforce.
 * Uses OAuth2 Username-Password flow (JSFORCE_REFERENCE.md Pattern 2).
 */

const jsforce = require('jsforce');
const orgRepo = require('../repositories/orgRepository');
const logger = require('../lib/logger');
const log = logger.create('salesforceService');

// Connection pool - reuse connections to leverage jsforce internal cache
const connectionPool = new Map();

/**
 * Create jsforce connection from SfOrg credentials
 * @param {Object} sfOrg - SfOrg model instance
 * @returns {Promise<jsforce.Connection>}
 */
async function createConnection(sfOrg) {
    log.info('Creating Salesforce connection', { sfOrgId: sfOrg.id, orgName: sfOrg.name, loginURL: sfOrg.loginURL });

    if (!sfOrg.username || !sfOrg.password) {
        throw new Error('Username and password are required');
    }

    if (!sfOrg.clientId || !sfOrg.clientSecret) {
        throw new Error('ClientId and ClientSecret are required for OAuth2 connection');
    }

    try {
        const conn = new jsforce.Connection({
            oauth2: {
                loginUrl: sfOrg.loginURL,
                clientId: sfOrg.clientId,
                clientSecret: sfOrg.clientSecret,
                redirectUri: `${sfOrg.loginURL}/services/oauth2/success`,
            },
            version: '65.0',
        });

        await conn.login(sfOrg.username, sfOrg.password + (sfOrg.securityToken || ''));

        log.info('Connection successful', {
            instanceUrl: conn.instanceUrl,
            hasAccessToken: !!conn.accessToken,
            hasRefreshToken: !!conn.refreshToken,
        });

        return conn;
    } catch (error) {
        log.error('Salesforce connection failed', error, { sfOrgId: sfOrg.id, orgName: sfOrg.name });

        if (error.message.includes('invalid_grant') || error.message.includes('authentication failure')) {
            throw new Error(
                'OAuth2 authentication failed.' + error.message
            );
        }

        throw new Error(`Failed to connect to Salesforce: ${error.message}`);
    }
}

/**
 * Connect to Salesforce org by ID (with connection pooling)
 */
async function connectToOrg(sfOrgId) {
    if (connectionPool.has(sfOrgId)) {
        const conn = connectionPool.get(sfOrgId);
        try {
            await conn.identity();
            log.info('Reusing cached connection', { sfOrgId });
            return conn;
        } catch (error) {
            log.warn('Cached connection invalid, creating new one', { sfOrgId });
            connectionPool.delete(sfOrgId);
        }
    }

    const sfOrg = await orgRepo.findById(sfOrgId);
    if (!sfOrg) {
        throw new Error(`Connection to org failed - org was not found: ${sfOrgId}`);
    }

    const conn = await createConnection(sfOrg);
    connectionPool.set(sfOrgId, conn);
    return conn;
}

/**
 * Clear cached connection for an org (useful after credential changes)
 */
function clearConnection(sfOrgId) {
    connectionPool.delete(sfOrgId);
    log.info('Cleared cached connection', { sfOrgId });
}

/**
 * Retrieve all objects from a Salesforce org via describeGlobal
 */
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

        log.toFile('', objects)
        return objects;
    } catch (error) {
        log.error('Failed to analyze org', error, { sfOrgId });
        throw new Error(`Failed to analyze org: ${error.message}`);
    }
}

/**
 * Get detailed metadata for a specific object
 */
async function describeObject(sfOrgId, objectName) {
    const conn = await connectToOrg(sfOrgId);

    try {
        const describeResult = await conn.describe(objectName);

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

/**
 * Get approximate record count for an object
 */
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

/**
 * Query records from Salesforce
 */
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

/**
 * Test connection to verify credentials
 */
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
    connectToOrg,
    clearConnection,
    describeGlobal,
    describeObject,
    getRecordCount,
    queryRecords,
    insertRecords,
    testConnection,
};
