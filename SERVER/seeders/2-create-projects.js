'use strict';

/** @type {import('sequelize-cli').Migration} */
/** Creates environment-specific projects for users */
module.exports = {
    up: async (queryInterface, Sequelize) => {
        const env = process.env.NODE_ENV || 'development';

        // Environment-specific project data
        const envSuffix = env === 'development' ? 'Dev' : env === 'test' ? 'Test' : 'Prod';

        const users = await queryInterface.sequelize.query(
            'SELECT id, firstname, lastname FROM "Users" ORDER BY "createdAt" ASC;',
            { type: Sequelize.QueryTypes.SELECT }
        );

        if (!users.length) {
            console.log('No users found. Skipping project seeding.');
            return;
        }

        const projects = [];
        for (const user of users) {
            // Create 2 projects per user
            let project1id = user.id.slice(0, -2) + '0' + user.id.slice(-1);
            let project2id = user.id.slice(0, -2) + '1' + user.id.slice(-1);

            projects.push({
                id: project1id,
                name: `Test_${envSuffix}`,
                description: `Test_Description_${envSuffix}`,
                userId: user.id,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            projects.push({
                id: project2id,
                name: `Project2_${envSuffix}`,
                description: `Second project for ${envSuffix} environment`,
                userId: user.id,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        console.log(`Seeding ${projects.length} projects for ${users.length} user(s) in ${env} environment.`);
        return queryInterface.bulkInsert('Projects', projects);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('Projects', null, {});
    }
};
