/**
 * List all SfOrgs in the database
 *
 * Usage: node scripts/db/list-orgs.js
 */

const { SfOrg } = require('../../models');

async function listOrgs() {
    try {
        const orgs = await SfOrg.findAll({
            attributes: ['id', 'name', 'loginURL', 'connectionType', 'username'],
        });

        console.log(`\nFound ${orgs.length} orgs in database:\n`);

        orgs.forEach(org => {
            console.log(`ID: ${org.id}`);
            console.log(`   Name: ${org.name}`);
            console.log(`   URL: ${org.loginURL}`);
            console.log(`   Type: ${org.connectionType}`);
            console.log(`   Username: ${org.username}`);
            console.log('');
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

listOrgs();
