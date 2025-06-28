'use strict';

/** @type {import('sequelize-cli').Migration} */
/** Creates one SfOrg per Project */
module.exports = {
    up: async (queryInterface, Sequelize) => {
        const projects = await queryInterface.sequelize.query(
            'SELECT id, name FROM "Projects" ORDER BY "createdAt" ASC;',
            { type: Sequelize.QueryTypes.SELECT }
        );

        if (!projects.length)
            return;

        const sforgs = [];
        for (const project of projects) {

             /* use  Sequelize.literal('uuid_generate_v4()')  for normal UUID, here we hardcode for simplicity
                users' UUIDs are assumed to be in the format 00000000-0000-4000-8000-000000000000, ....1, ....2, etc.
                For projects, the 2nd-to-last bit of the UUID is used and follows the same pattern.
                For SfOrgs, the 3nd-to-last bit of the UUID is used and follows the same pattern.
                    1st user:                       00000000-0000-4000-8000-000000000000
                    2nd user:                       00000000-0000-4000-8000-000000000001

                    1st user, 1st project:          00000000-0000-4000-8000-000000000000
                    1st user, 1st project, 1st org: 00000000-0000-4000-8000-000000000000

                    1st user, 2nd project:          00000000-0000-4000-8000-000000000010
                    1st user, 2nd project, 1st org: 00000000-0000-4000-8000-000000000010

                    Not implemented, but for a 2nd org would be:

                    1st user, 2nd project:          00000000-0000-4000-8000-000000000010
                    1st user, 2nd project, 2nd org: 00000000-0000-4000-8000-000000000110
            */
            let sforgid = project.id.slice(0, -3) + '0' + project.id.slice(-2);
            sforgs.push({
                id: sforgid,
                name: `DQ for: ${project.name}`,
                description: `Trailhead Playgroung Org for: ${project.name}.`,
                loginURL: 'https://cunning-impala-2gz1vt-dev-ed.trailblaze.my.salesforce.com',
                connectionType: 'Credentials',
                username: `georzaza@cunning-impala-2gz1vt.com`,
                password: '6u1nxqD6a!',
                securityToken: '2vfR24CZzqzmXIZk6hoffIBFM',
                clientId: null,
                clientSecret: null,
                projectId: project.id,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
        console.log(`Creating ${sforgs.length} SfOrgs for ${projects.length} projects.`);
        return queryInterface.bulkInsert('SfOrgs', sforgs);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('SfOrgs', null, {});
    }
};
