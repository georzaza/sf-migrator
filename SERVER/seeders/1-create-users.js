'use strict';

const bcrypt = require('bcrypt');
const saltRounds = 10;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    up: async (queryInterface, Sequelize) => {
        const env = process.env.NODE_ENV || 'development';

        // Environment-specific user data
        const envSuffix = env === 'development' ? 'Dev' : env === 'test' ? 'Test' : 'Prod';
        const envLower = env === 'development' ? 'dev' : env === 'test' ? 'test' : 'prod';

        // Common password for both dev and test
        const hashedPassword = await bcrypt.hash('6u1nxqD6a!', saltRounds);

        const users = [
            {
                id: '00000000-0000-4000-8000-000000000000',
                email: 'georzaza@gmail.com',
                password: hashedPassword,
                firstname: `Geo_${envSuffix}`,
                lastname: `Zaza_${envSuffix}`,
                username: `georzaza_${envLower}`,
                role: 'user',
                isActive: true,
                emailVerified: false,
                lastLogin: null,
                resetPasswordToken: null,
                resetPasswordExpires: null,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        console.log(`Seeding user for ${env} environment: ${users[0].username}`);
        return queryInterface.bulkInsert('Users', users);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('Users', null, {});
    }
};
