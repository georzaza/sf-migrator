/**
 * Bulk Ingest Service — Salesforce Bulk API 2.0 ingest (load) plumbing.
 *
 * Thin wrapper around jsforce `conn.bulk2.loadAndWaitForResults`. The load
 * orchestrator owns batching/ordering; this module just builds an authenticated
 * connection to a target org and runs a single ingest job, returning the parsed
 * per-record results.
 *
 * Correlation note: Bulk 2.0 result files echo back the fields we uploaded
 * (alongside sf__Id / sf__Error) but do NOT guarantee row order. We therefore
 * always include the chosen External Id field (carrying the SOURCE record Id) in
 * every record, so each result row can be matched back to its source record.
 */

import jsforce from 'jsforce';

import orgRepo from '../repositories/orgRepository.js';
import logger from '../lib/logger.js';

const log = logger.create('bulkIngestService');

const SF_API_VERSION = '66.0';

/**
 * Build an authenticated jsforce connection to an org, refreshing the access
 * token if needed (and persisting any refreshed tokens). Mirrors the connection
 * setup used by extractionService.
 */
async function buildConnection(orgId) {
    if (!orgId) {
        throw new Error('orgId is required');
    }

    const org = await orgRepo.findById(orgId);
    if (!org) {
        throw new Error(`Org not found: ${orgId}`);
    }
    if (!org.accessToken) {
        throw new Error(`No access token found for org ${orgId}. Please complete the org analysis first.`);
    }
    if (!org.loginURL) {
        throw new Error(`Org loginURL is missing for org ${orgId}`);
    }

    const oauth2 = new jsforce.OAuth2({
        loginUrl: org.loginURL,
        clientId: org.clientId,
        clientSecret: org.clientSecret,
        redirectUri: process.env.SF_REDIRECT_URI,
    });

    const conn = new jsforce.Connection({
        oauth2,
        instanceUrl: org.instanceUrl || org.loginURL,
        accessToken: org.accessToken,
        refreshToken: org.refreshToken,
        version: SF_API_VERSION,
    });

    if (org.refreshToken) {
        try {
            await conn.identity(); // auto-refreshes if the token is expired
            if (conn.accessToken !== org.accessToken) {
                await orgRepo.update(orgId, {
                    accessToken: conn.accessToken,
                    refreshToken: conn.refreshToken,
                }).catch((err) => log.warn('Failed to update refreshed tokens', err));
            }
        } catch (error) {
            log.error('Failed to verify/refresh connection', error, { orgId });
            throw new Error(`Authentication failed for org ${orgId}. Please re-authenticate the org.`);
        }
    }

    return conn;
}

/**
 * Run a single Bulk API 2.0 ingest job and return parsed results.
 *
 * @param {object} params
 * @param {object} params.conn                jsforce connection (from buildConnection)
 * @param {string} params.objectName          target SObject API name
 * @param {Array<object>} params.records       records to load (plain key->value objects)
 * @param {string} [params.operation='insert'] insert | update | upsert | delete
 * @param {string} [params.externalIdFieldName] required for upsert
 * @returns {Promise<{successfulResults: Array, failedResults: Array, unprocessedRecords: Array|string}>}
 */
async function ingestRecords({ conn, objectName, records, operation = 'insert', externalIdFieldName }) {
    if (!conn) throw new Error('conn is required');
    if (!objectName) throw new Error('objectName is required');
    if (!Array.isArray(records)) throw new Error('records must be an array');

    if (records.length === 0) {
        return { successfulResults: [], failedResults: [], unprocessedRecords: [] };
    }

    const options = { object: objectName, operation, input: records };
    if (externalIdFieldName) {
        options.externalIdFieldName = externalIdFieldName;
    }

    log.info('Starting Bulk 2.0 ingest', { objectName, operation, recordCount: records.length });
    const results = await conn.bulk2.loadAndWaitForResults(options);
    log.info('Bulk 2.0 ingest finished', {
        objectName,
        operation,
        successCount: results.successfulResults?.length || 0,
        failedCount: results.failedResults?.length || 0,
    });

    return {
        successfulResults: results.successfulResults || [],
        failedResults: results.failedResults || [],
        unprocessedRecords: results.unprocessedRecords || [],
    };
}

export default {
    buildConnection,
    ingestRecords,
};
