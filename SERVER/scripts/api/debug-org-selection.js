/**
 * Debug org selection flow
 *
 * Simulates the UI workflow: list orgs → select org → fetch objects → fetch stats.
 * Requires a running server and valid JWT token.
 *
 * Usage:
 *   node scripts/api/debug-org-selection.js                # list orgs
 *   node scripts/api/debug-org-selection.js <orgId>        # test selection
 *
 * Set AUTH_TOKEN below to a valid JWT from your browser cookies.
 */

const SERVER_URL = 'http://localhost:3000';
const AUTH_TOKEN = 'your-jwt-token-here-from-browser-cookies';

async function fetchJson(url, options) {
    const res = await fetch(url, options);
    return { status: res.status, data: await res.json() };
}

async function listAvailableOrgs() {
    console.log('\nListing Available Orgs\n');
    try {
        const { status, data } = await fetchJson(SERVER_URL, {
            headers: { action: 'get-orgs', Cookie: `auth_token=${AUTH_TOKEN}` },
        });

        if (!data.success) {
            console.log(`   [${status}] ${data.message}`);
            return [];
        }

        console.log(`   Found ${data.data.length} orgs\n`);
        data.data.forEach((org, i) => {
            console.log(`   ${i + 1}. ${org.name} (ID: ${org.id})`);
            console.log(`      Project: ${org.projectId}`);
            console.log(`      Type: ${org.connectionType}\n`);
        });
        return data.data;
    } catch (error) {
        console.error(`   Error: ${error.message}`);
        return [];
    }
}

async function testOrgSelection(orgId) {
    console.log(`\nTesting Org Selection for: ${orgId}\n`);

    try {
        // Step 1: Fetch objects
        console.log('1. Fetching objects...');
        const { status: s1, data: d1 } = await fetchJson(`${SERVER_URL}?includeFields=false`, {
            headers: { action: 'get-objects', orgid: orgId, Cookie: `auth_token=${AUTH_TOKEN}` },
        });

        if (d1.success) {
            console.log(`   [OK] ${d1.data.length} objects`);
            if (d1.data.length === 0) {
                console.log('   No metadata found. Has this org been analyzed?');
            } else {
                console.log(`   Sample: ${d1.data.slice(0, 3).map(o => o.objectName).join(', ')}`);
            }
        } else {
            console.log(`   [${s1}] ${d1.message}`);
        }

        // Step 2: Fetch stats
        console.log('\n2. Fetching metadata stats...');
        const { status: s2, data: d2 } = await fetchJson(SERVER_URL, {
            headers: { action: 'get-metadata-stats', orgid: orgId, Cookie: `auth_token=${AUTH_TOKEN}` },
        });

        if (d2.success) {
            console.log('   [OK] Stats:', d2.data);
        } else {
            console.log(`   [${s2}] ${d2.message}`);
        }

        return true;
    } catch (error) {
        console.error(`   Error: ${error.message}`);
        console.log('\n   Make sure the server is running and AUTH_TOKEN is set.');
        return false;
    }
}

async function main() {
    console.log('Org Selection Debug Tool');
    console.log(`Server: ${SERVER_URL}\n`);

    const orgId = process.argv[2];

    if (!orgId) {
        const orgs = await listAvailableOrgs();
        if (orgs.length > 0) {
            console.log('Run again with an org ID:');
            console.log(`  node scripts/api/debug-org-selection.js ${orgs[0].id}`);
        }
        return;
    }

    await testOrgSelection(orgId);
}

main();
