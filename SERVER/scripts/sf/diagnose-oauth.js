/**
 * Diagnose OAuth connection for a specific org
 *
 * Tests the full OAuth2 Username-Password flow and provides detailed
 * troubleshooting guidance on failure.
 *
 * Usage: node scripts/sf/diagnose-oauth.js <orgId>
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../src/.env') });

const { SfOrg, sequelize } = require('../../models');
const jsforce = require('jsforce');

async function diagnoseConnection(orgId) {
    try {
        console.log('\nOAuth Connection Diagnostic');
        console.log('='.repeat(60));

        const org = await SfOrg.findByPk(orgId);
        if (!org) {
            console.error(`Org not found with ID: ${orgId}`);
            return;
        }

        console.log(`\nOrg Details:`);
        console.log(`   Name: ${org.name}`);
        console.log(`   Type: ${org.connectionType}`);
        console.log(`   Username: ${org.username}`);
        console.log(`   Login URL: ${org.loginURL}`);

        const clientId = org.clientId || process.env.SF_CLIENT_ID;
        const clientSecret = org.clientSecret || process.env.SF_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            console.error(`\n[FAIL] Missing OAuth credentials!`);
            console.error(`   Client ID: ${clientId ? 'Found' : 'Missing'}`);
            console.error(`   Client Secret: ${clientSecret ? 'Found' : 'Missing'}`);
            return;
        }

        console.log(`   Client ID: ${clientId.substring(0, 15)}...`);
        console.log(`   Client Secret: ${clientSecret.substring(0, 10)}...`);

        console.log(`\nCredentials Check:`);
        console.log(`   Password: ${org.password?.length || 0} chars`);
        console.log(`   Security Token: ${org.securityToken?.length || 0} chars`);

        if (!org.password) {
            console.error(`   [FAIL] Password is missing!`);
            return;
        }
        if (!org.securityToken) {
            console.warn(`   [WARN] Security Token is missing - may cause auth failure`);
        }

        console.log(`\nAttempting OAuth Connection...`);
        console.log(`   Method: OAuth 2.0 Username-Password Flow`);

        const conn = new jsforce.Connection({
            oauth2: {
                loginUrl: org.loginURL || 'https://login.salesforce.com',
                clientId,
                clientSecret,
                redirectUri: `${org.loginURL}/services/oauth2/success`,
            },
            version: '60.0',
        });

        try {
            await conn.login(org.username, org.password + (org.securityToken || ''));

            console.log(`\n[OK] Connection successful`);
            console.log(`   Access Token: ${conn.accessToken?.substring(0, 20)}...`);
            console.log(`   Instance URL: ${conn.instanceUrl}`);

            const result = await conn.query(`SELECT Id, Name FROM User LIMIT 1`);
            console.log(`[OK] Test query successful (${result.totalSize} records)`);
        } catch (authError) {
            console.error(`\n[FAIL] Authentication failed: ${authError.message}`);
            console.log(`\nTroubleshooting:`);
            console.log(`  1. Setup > App Manager > [Connected App] > Manage > Edit Policies:`);
            console.log(`     - Permitted Users: "All users may self-authorize"`);
            console.log(`     - IP Relaxation: "Relax IP restrictions"`);
            console.log(`  2. Setup > Identity > OAuth and OpenID Connect Settings:`);
            console.log(`     - Enable "OAuth Username-Password Flow"`);
            console.log(`  3. Verify username, password, and security token`);
            console.log(`  4. Verify Consumer Key/Secret from Connected App`);
        }
    } catch (error) {
        console.error(`Diagnostic error:`, error.message, error);
    } finally {
        await sequelize.close();
    }
}

const orgId = process.argv[2];
if (!orgId) {
    console.error('Usage: node scripts/sf/diagnose-oauth.js <orgId>');
    process.exit(1);
}

diagnoseConnection(orgId);
