'use strict';

const realOrgs = require('../tests/fixtures/realOrgs');

/** @type {import('sequelize-cli').Migration} */
/** Creates real Salesforce orgs for testing - same orgs in all environments */
module.exports = {
    up: async (queryInterface, Sequelize) => {
        const env = process.env.NODE_ENV || 'development';

        const projects = await queryInterface.sequelize.query(
            'SELECT id, name FROM "Projects" ORDER BY "createdAt" ASC;',
            { type: Sequelize.QueryTypes.SELECT }
        );

        if (!projects.length) {
            console.log('No projects found. Skipping SfOrg seeding.');
            return;
        }

        const sforgs = [];

        // Create 2 orgs per project using real Salesforce credentials
        for (const project of projects) {
            // First org: Superbadge Formulas
            const formulasOrg = realOrgs.realOrgs.superbadgeFormulas;
            let formulasOrgId = project.id.slice(0, -3) + '0' + project.id.slice(-2);

            sforgs.push({
                id: formulasOrgId,
                name: formulasOrg.name,
                description: formulasOrg.description,
                loginURL: formulasOrg.loginURL,
                connectionType: formulasOrg.connectionType,
                username: formulasOrg.username,
                password: formulasOrg.password,
                securityToken: formulasOrg.securityToken,
                clientId: formulasOrg.clientId || null,
                clientSecret: formulasOrg.clientSecret || null,
                projectId: project.id,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Second org: Superbadge Apex Web Services
            const apexOrg = realOrgs.realOrgs.superbadgeApexWebServices;
            let apexOrgId = project.id.slice(0, -3) + '1' + project.id.slice(-2);

            sforgs.push({
                id: apexOrgId,
                name: apexOrg.name,
                description: apexOrg.description,
                loginURL: apexOrg.loginURL,
                connectionType: apexOrg.connectionType,
                username: apexOrg.username,
                password: apexOrg.password,
                securityToken: apexOrg.securityToken,
                clientId: apexOrg.clientId || null,
                clientSecret: apexOrg.clientSecret || null,
                projectId: project.id,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        console.log(`Seeding ${sforgs.length} real Salesforce orgs for ${projects.length} project(s) in ${env} environment.`);
        return queryInterface.bulkInsert('SfOrgs', sforgs);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('SfOrgs', null, {});
    }
};
