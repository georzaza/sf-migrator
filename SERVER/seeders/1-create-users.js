'use strict';

const bcrypt = require('bcrypt');
const saltRounds = 10;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    up: async (queryInterface, Sequelize) => {
        const env = process.env.NODE_ENV || 'development';
        const envSuffix = env === 'development' ? 'Dev' : env === 'test' ? 'Test' : 'Prod';
        const envLower = env === 'development' ? 'dev' : env === 'test' ? 'test' : 'prod';

        const hashedPassword = await bcrypt.hash('Passw0rd!', saltRounds);

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
            }, {
                id: '00000000-0000-4000-8000-100000000000',
                email: 'georzaza@gmail2.com',
                password: hashedPassword,
                firstname: `Geo_${envSuffix}_2`,
                lastname: `Zaza_${envSuffix}_2`,
                username: `georzaza_${envLower}_2`,
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

        console.log(`Created Users: ${JSON.stringify(users, null, 2)}`);
        return queryInterface.bulkInsert('Users', users);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('Users', null, {});
    }
};
