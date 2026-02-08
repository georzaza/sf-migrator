/**
 * Inspect org credentials stored in the database
 *
 * Usage:
 *   node scripts/db/check-org-credentials.js           # show all orgs
 *   node scripts/db/check-org-credentials.js <orgId>   # show specific org
 */

const { SfOrg } = require('../../models');

function displayOrgCredentials(org) {
    console.log(`\nOrg: ${org.name}`);
    console.log(`   ID: ${org.id}`);
    console.log(`   Project ID: ${org.projectId}`);
    console.log(`   Connection Type: ${org.connectionType}`);
    console.log(`   Login URL: ${org.loginURL}`);

    if (org.connectionType === 'Credentials') {
        console.log(`\n   Credentials:`);
        console.log(`      Username: ${org.username || 'MISSING'}`);
        console.log(`      Password: ${org.password ? 'Present (' + org.password.length + ' chars)' : 'MISSING'}`);
        console.log(`      Security Token: ${org.securityToken ? 'Present (' + org.securityToken.length + ' chars)' : 'MISSING'}`);

        const isValid = org.username && org.password && org.securityToken;
        console.log(`   Status: ${isValid ? 'All required credentials present' : 'Missing required credentials'}`);
    } else if (org.connectionType === 'OAuth') {
        console.log(`\n   OAuth Credentials:`);
        console.log(`      Username: ${org.username || 'MISSING'}`);
        console.log(`      Password: ${org.password ? 'Present (' + org.password.length + ' chars)' : 'MISSING'}`);
        console.log(`      Security Token: ${org.securityToken ? 'Present (' + org.securityToken.length + ' chars)' : 'MISSING'}`);
        console.log(`      Client ID: ${org.clientId || 'MISSING'}`);
        console.log(`      Client Secret: ${org.clientSecret ? 'Present' : 'MISSING'}`);

        const isValid = org.clientId && org.clientSecret && org.username && org.password;
        console.log(`   Status: ${isValid ? 'All required OAuth credentials present' : 'Missing required OAuth credentials'}`);
    }
}

async function checkCredentials(orgId) {
    try {
        if (orgId) {
            const org = await SfOrg.findByPk(orgId);
            if (!org) {
                console.log(`Org not found: ${orgId}`);
                process.exit(1);
            }
            displayOrgCredentials(org);
        } else {
            const orgs = await SfOrg.findAll();
            console.log(`\nFound ${orgs.length} org(s) in database:`);
            for (const o of orgs) {
                displayOrgCredentials(o);
                console.log('-----------------------------------');
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message, error);
        process.exit(1);
    }
}

const orgId = process.argv[2];

if (!orgId) {
    console.log('No org ID provided - showing all orgs');
    console.log('Usage: node scripts/db/check-org-credentials.js [orgId]\n');
}

checkCredentials(orgId);
