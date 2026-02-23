'use strict';

const realOrgs = require('./realOrgs/realOrgs')

/** @type {import('sequelize-cli').Migration} */
/** Creates real Salesforce orgs for testing - same orgs for all users */
module.exports = {
    up: async (queryInterface, Sequelize) => {
        const env = process.env.NODE_ENV || 'development';

        const users = await queryInterface.sequelize.query(
            'SELECT id FROM "Users" ORDER BY "createdAt" ASC;',
            { type: Sequelize.QueryTypes.SELECT }
        );

        if (!users.length) {
            console.log('No users found. Skipping SfOrg seeding.');
            return;
        }

        const sforgs = [];

        // Create 2 orgs per user
        let idx = 0;
        for (const user of users) {

            // First org: Superbadge Formulas
            const formulasOrg = realOrgs.realOrgs.superbadgeFormulas;
            let formulasOrgId = user.id.slice(0, -3) + '0' + user.id.slice(-2);

            sforgs.push({
                id: formulasOrgId,
                name: formulasOrg.name + ` (User ${++idx})`,
                description: formulasOrg.description + ` (User ${++idx})`,
                loginURL: formulasOrg.loginURL,
                connectionType: 'OAuth',
                clientId: formulasOrg.clientId || null,
                clientSecret: formulasOrg.clientSecret || null,
                userId: user.id,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Second org: Superbadge Apex Web Services
            const apexOrg = realOrgs.realOrgs.superbadgeApexWebServices;
            let apexOrgId = user.id.slice(0, -3) + '1' + user.id.slice(-2);

            sforgs.push({
                id: apexOrgId,
                name: apexOrg.name + ` (User ${++idx})`,
                description: apexOrg.description + ` (User ${++idx})`,
                loginURL: apexOrg.loginURL,
                connectionType: 'OAuth',
                clientId: apexOrg.clientId || null,
                clientSecret: apexOrg.clientSecret || null,
                userId: user.id,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        console.log(`Seeding ${sforgs.length} real Salesforce orgs for ${users.length} user(s) in ${env} environment.`);
        return queryInterface.bulkInsert('SfOrgs', sforgs);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('SfOrgs', null, {});
    }
};
