/**
 * Test Salesforce connection for an org (supports both Credentials and OAuth types)
 *
 * Usage: node scripts/sf/test-connection.js <orgId>
 */

const { SfOrg } = require('../../models');
const jsforce = require('jsforce');

async function testConnection(orgId) {
    try {
        const org = await SfOrg.findByPk(orgId);

        if (!org) {
            console.log(`Org not found: ${orgId}`);
            process.exit(1);
        }

        console.log(`\nTesting connection for org: ${org.name}`);
        console.log(`   ID: ${org.id}`);
        console.log(`   Login URL: ${org.loginURL}`);
        console.log(`   Connection Type: ${org.connectionType}\n`);

        let conn;

        if (org.connectionType === 'Credentials') {
            console.log('Using direct credentials:');
            console.log(`   Username: ${org.username}`);
            console.log(`   Password: ${'*'.repeat(org.password?.length || 0)} (${org.password?.length || 0} chars)`);
            console.log(`   Security Token: ${org.securityToken?.length || 0} chars\n`);

            conn = new jsforce.Connection({
                loginUrl: org.loginURL || 'https://login.salesforce.com',
            });
        } else {
            console.log('Using OAuth credentials:');
            console.log(`   Username: ${org.username}`);
            console.log(`   Client ID: ${org.clientId?.substring(0, 20)}...`);
            console.log(`   Client Secret: ${org.clientSecret?.substring(0, 20)}...\n`);

            conn = new jsforce.Connection({
                oauth2: {
                    loginUrl: org.loginURL || 'https://login.salesforce.com',
                    clientId: org.clientId,
                    clientSecret: org.clientSecret,
                    redirectUri: `${org.loginURL}/services/oauth2/success`,
                },
                version: '60.0',
            });
        }

        console.log('Attempting login...');
        try {
            const loginResult = await conn.login(org.username, org.password + (org.securityToken || ''));

            console.log(`[OK] Login successful`);
            console.log(`   User ID: ${loginResult.id}`);
            console.log(`   Org ID: ${loginResult.organizationId}`);
            console.log(`   Instance URL: ${conn.instanceUrl}\n`);

            const identity = await conn.identity();
            console.log(`[OK] Identity verified: ${identity.display_name} (${identity.username})`);
            process.exit(0);
        } catch (loginError) {
            console.log(`[FAIL] Login failed`);
            console.log(`   Error: ${loginError.name} - ${loginError.message}`);

            if (loginError.errorCode === 'INVALID_LOGIN') {
                console.log(`\nTroubleshooting:`);
                console.log(`   - Verify username is correct`);
                console.log(`   - Verify password is correct`);
                console.log(`   - Verify security token is current`);
                console.log(`   - Check if user account is locked`);
            }
            process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error.message, error);
        process.exit(1);
    }
}

const orgId = process.argv[2];
if (!orgId) {
    console.log('Usage: node scripts/sf/test-connection.js <orgId>');
    console.log('\nRun: node scripts/db/list-orgs.js  to see available org IDs');
    process.exit(1);
}

testConnection(orgId);
