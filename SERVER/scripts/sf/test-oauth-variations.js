/**
 * Test OAuth login with password+token and password-only variations
 *
 * Usage: node scripts/sf/test-oauth-variations.js <orgId>
 */

const { SfOrg } = require('../../models');
const jsforce = require('jsforce');

async function testOAuthVariations(orgId) {
    const org = await SfOrg.findByPk(orgId);

    if (!org) {
        console.log(`Org not found: ${orgId}`);
        process.exit(1);
    }

    console.log(`\nTesting OAuth variations for: ${org.name}\n`);

    const oauth2Config = {
        loginUrl: org.loginURL,
        clientId: org.clientId,
        clientSecret: org.clientSecret,
        redirectUri: `${org.loginURL}/services/oauth2/success`,
    };

    // Test 1: Password + Security Token
    console.log('Test 1: Username-Password with Security Token');
    try {
        const conn1 = new jsforce.Connection({ oauth2: oauth2Config, version: '60.0' });
        await conn1.login(org.username, org.password + org.securityToken);
        console.log(`[OK] Success with password + token`);
        console.log(`   Access Token: ${conn1.accessToken.substring(0, 20)}...`);
        process.exit(0);
    } catch (err) {
        console.log(`[FAIL] ${err.message}`);
    }

    // Test 2: Password only
    console.log('\nTest 2: Username-Password without Security Token');
    try {
        const conn2 = new jsforce.Connection({ oauth2: oauth2Config, version: '60.0' });
        await conn2.login(org.username, org.password);
        console.log(`[OK] Success with password only`);
        console.log(`   Access Token: ${conn2.accessToken.substring(0, 20)}...`);
        process.exit(0);
    } catch (err) {
        console.log(`[FAIL] ${err.message}`);
    }

    console.log(`\nBoth variations failed. Check:`);
    console.log(`   1. Connected App > Permitted Users = "All users may self-authorize"`);
    console.log(`   2. User profile has "API Enabled" permission`);
    console.log(`   3. No IP restrictions on Connected App`);
    console.log(`   4. OAuth Username-Password flow enabled in org settings`);

    process.exit(1);
}

const orgId = process.argv[2];
if (!orgId) {
    console.log('Usage: node scripts/sf/test-oauth-variations.js <orgId>');
    console.log('\nRun: node scripts/db/list-orgs.js  to see available org IDs');
    process.exit(1);
}

testOAuthVariations(orgId);
