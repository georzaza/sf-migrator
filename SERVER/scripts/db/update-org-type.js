/**
 * Update an org's connection type and credentials
 *
 * Usage:
 *   node scripts/db/update-org-type.js <orgId> --type=OAuth     # switch to OAuth
 *   node scripts/db/update-org-type.js <orgId> --type=Credentials # switch to Credentials
 */

const { SfOrg } = require('../../models');

// Default OAuth credentials (edit as needed)
const OAUTH_DEFAULTS = {
    clientId: '3MVG9YFqzc_KnL.yKgyiri.fuca75.r.8qiAz8d_FIEy09rnsWIXi3b.KlZfHrqRQzY6MaUBcGmrlC3MSO969',
    clientSecret: '37B38F0ECA9761FCD1802354D6BBA8E784F9E656C84818025A0151FB7A395D08',
    loginURL: 'https://deloittegrsuperbadgeformula-dev-ed.develop.my.salesforce.com',
    username: 'gzazanis@deloitte.gr_superbadge_formulas',
    password: '6u1nxqD6a@',
    securityToken: 'zKDXzphgZaWxeSdivLEmkxB53',
};

async function updateOrgType(orgId, targetType) {
    try {
        const org = await SfOrg.findByPk(orgId);

        if (!org) {
            console.log(`Org not found: ${orgId}`);
            process.exit(1);
        }

        console.log(`Updating org: ${org.name}`);
        console.log(`   Current type: ${org.connectionType}`);
        console.log(`   Target type: ${targetType}\n`);

        if (targetType === 'OAuth') {
            await org.update({
                connectionType: 'OAuth',
                ...OAUTH_DEFAULTS,
            });
            console.log(`[OK] Org updated to OAuth`);
            console.log(`   Client ID: ${OAUTH_DEFAULTS.clientId.substring(0, 20)}...`);
            console.log(`   Login URL: ${OAUTH_DEFAULTS.loginURL}`);
        } else if (targetType === 'Credentials') {
            await org.update({ connectionType: 'Credentials' });
            console.log(`[OK] Org updated to Credentials`);
        } else {
            console.error(`Unknown type: ${targetType}. Use --type=OAuth or --type=Credentials`);
            process.exit(1);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message, error);
        process.exit(1);
    }
}

const orgId = process.argv[2];
const typeArg = process.argv.find(a => a.startsWith('--type='));
const targetType = typeArg ? typeArg.split('=')[1] : null;

if (!orgId || !targetType) {
    console.log('Usage: node scripts/db/update-org-type.js <orgId> --type=OAuth|Credentials');
    process.exit(1);
}

updateOrgType(orgId, targetType);
