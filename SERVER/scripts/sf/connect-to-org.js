/**
 * Standalone Salesforce connection test (no DB required)
 *
 * Tests OAuth2 Username-Password flow directly with hardcoded credentials.
 * Runs: login → describe Account → describeGlobal
 *
 * Usage: node scripts/sf/connect-to-org.js
 */

const jsforce = require('jsforce');

const sfOrg = {
    username: 'gzazanis@deloitte.gr_superbadge_formulas',
    password: '6u1nxqD6a@',
    securityToken: 'zKDXzphgZaWxeSdivLEmkxB53',
    clientId: '3MVG9YFqzc_KnL.yKgyiri.fuca75.r.8qiAz8d_FIEy09rnsWIXi3b.KlZfHrqRQzY6MaUBcGmrlC3MSO969',
    clientSecret: '37B38F0ECA9761FCD1802354D6BBA8E784F9E656C84818025A0151FB7A395D08',
    loginURL: 'https://deloittegrsuperbadgeformula-dev-ed.develop.my.salesforce.com',
};

async function main() {
    const conn = new jsforce.Connection({
        oauth2: {
            loginUrl: sfOrg.loginURL,
            clientId: sfOrg.clientId,
            clientSecret: sfOrg.clientSecret,
            redirectUri: `${sfOrg.loginURL}/services/oauth2/success`,
        },
        version: '60.0',
    });

    try {
        await conn.login(sfOrg.username, sfOrg.password + sfOrg.securityToken);
        console.log('Login successful');
    } catch (error) {
        console.error('Login failed:', error.message);
        return;
    }

    try {
        const describe = await conn.describe('Account');
        console.log('Describe successful:', describe.fields.length, 'fields');
    } catch (error) {
        console.error('Describe failed:', error.message);
        return;
    }

    try {
        const globalDescribe = await conn.describeGlobal();
        console.log('Global describe successful:', globalDescribe.sobjects.length, 'sObjects');
    } catch (error) {
        console.error('Global describe failed:', error.message);
    }
}

main();
