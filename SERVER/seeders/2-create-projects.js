'use strict';

/** @type {import('sequelize-cli').Migration} */
/** Creates some projects for all users */
module.exports = {
    up: async (queryInterface, Sequelize) => {

        const users = await queryInterface.sequelize.query(
            'SELECT id, firstname, lastname FROM "Users" ORDER BY "createdAt" ASC;',
            { type: Sequelize.QueryTypes.SELECT }
        );

        if (!users.length) return;

        const projects = [];
        for (const user of users) {
            const name = `${user.firstname} ${user.lastname}`;

            /* use  Sequelize.literal('uuid_generate_v4()')  for normal UUID, here we hardcode for simplicity
               users' UUIDs are assumed to be in the format 00000000-0000-4000-8000-000000000000, ....1, ....2, etc.
               For projects, the 2nd-to-last bit of the UUID is used and follows the same pattern.*/
            let project1id = user.id.slice(0, -2) + '0' + user.id.slice(-1);
            let project2id = user.id.slice(0, -2) + '1' + user.id.slice(-1);

            projects.push({
                id: project1id,
                name: `Demo project for User ${name}`,
                description: `This is a demo project created for user ${name}.`,
                userId: user.id,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            projects.push({
                id: project2id,
                name: `Test project for User ${name}`,
                description: `This is a test project created for user ${name}.`,
                userId: user.id,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
        console.log(`Creating ${projects.length} projects for ${users.length} users.`);
        return queryInterface.bulkInsert('Projects', projects);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('Projects', null, {});
    }
};
