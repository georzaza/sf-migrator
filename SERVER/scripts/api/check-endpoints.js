/**
 * Manual API endpoint check
 *
 * Tests login, get-orgs, and get-projects endpoints against a running server.
 * Server must be running on localhost:3000.
 *
 * Usage: node scripts/api/check-endpoints.js
 */

const SERVER_URL = 'http://localhost:3000';

async function checkEndpoints() {
    console.log(`\nTesting API endpoints on ${SERVER_URL}\n`);

    // 1. Login
    console.log('1. POST /auth/login');
    try {
        const loginRes = await fetch(`${SERVER_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                action: 'login',
            },
            credentials: 'include',
            body: JSON.stringify({
                userIdentifier: 'demo@demo.com',
                password: 'demoPassword',
            }),
        });
        const loginData = await loginRes.json();
        console.log(`   Status: ${loginRes.status}`);
        console.log(`   Response:`, loginData);

        // Extract cookie for subsequent requests
        const setCookie = loginRes.headers.get('set-cookie');
        const cookie = setCookie || '';

        // 2. Get orgs
        console.log('\n2. GET / (action: get-orgs)');
        const orgsRes = await fetch(`${SERVER_URL}/`, {
            method: 'GET',
            headers: { action: 'get-orgs', Cookie: cookie },
            credentials: 'include',
        });
        const orgsData = await orgsRes.json();
        console.log(`   Status: ${orgsRes.status}`);
        console.log(`   Response:`, orgsData);

        // 3. Get projects
        console.log('\n3. GET / (action: get-projects)');
        const projRes = await fetch(`${SERVER_URL}/`, {
            method: 'GET',
            headers: { action: 'get-projects', Cookie: cookie },
            credentials: 'include',
        });
        const projData = await projRes.json();
        console.log(`   Status: ${projRes.status}`);
        console.log(`   Response:`, projData);
    } catch (error) {
        console.error(`   Error: ${error.message}`);
        console.log(`\n   Make sure the server is running: cd SERVER/src && node server.js`);
    }
}

checkEndpoints();
