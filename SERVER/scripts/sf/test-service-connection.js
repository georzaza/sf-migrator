/**
 * Test Salesforce connection via salesforceService (reads from DB)
 *
 * Uses the application's actual service layer to connect and analyze.
 *
 * Usage: node scripts/sf/test-service-connection.js <orgId>
 */

const path = require('path');

const env = process.env.NODE_ENV || 'development';
require('dotenv').config({
    path: path.resolve(__dirname, `../../.env.${env}`),
});

const salesforceService = require('../../src/services/salesforceService');

async function testServiceConnection(orgId) {
    console.log(`\nTesting Salesforce Service Connection\n`);
    console.log(`Org ID: ${orgId}`);
    console.log(`Using: salesforceService.testConnection()\n`);

    try {
        console.log('Connecting...');

        const result = await salesforceService.testConnection(orgId);

        console.log(`\n[OK] Connection successful\n`);
        console.log(`   User ID: ${result.userId}`);
        console.log(`   Username: ${result.username}`);
        console.log(`   Org ID: ${result.orgId}`);
        console.log(`   Display Name: ${result.displayName}\n`);

        console.log('Testing org analysis...');
        const objects = await salesforceService.analyzeOrg(orgId);
        console.log(`[OK] Found ${objects.length} objects`);
        console.log(`   Sample: ${objects.slice(0, 5).map(o => o.objectName).join(', ')}\n`);

        console.log('[OK] All tests passed');
        process.exit(0);
    } catch (error) {
        console.error(`\n[FAIL] Connection failed\n`);
        console.error(`   Error: ${error.message}\n`);
        process.exit(1);
    }
}

const orgId = process.argv[2];
if (!orgId) {
    console.log('Usage: node scripts/sf/test-service-connection.js <orgId>');
    console.log('\nRun: node scripts/db/list-orgs.js  to see available org IDs');
    process.exit(1);
}

testServiceConnection(orgId);
