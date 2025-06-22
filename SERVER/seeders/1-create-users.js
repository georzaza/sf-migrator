'use strict';

const bcrypt = require('bcrypt');
const saltRounds = 10;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    up: async (queryInterface, Sequelize) => {

         // Sequelize.literal('uuid_generate_v4()')  for normal UUID, here we hardcode for simplicity
        const users = [
            {
                id: '00000000-0000-4000-8000-000000000000',
                email: 'demo@demo.com',
                password: await bcrypt.hash('demoPassword', saltRounds),
                firstname: 'Demo',
                lastname: 'User',
                role: 'user',
                isActive: true,
                emailVerified: false,
                lastLogin: null,
                resetPasswordToken: null,
                resetPasswordExpires: null,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: '00000000-0000-4000-8000-000000000001',
                email: 'test@test.com',
                password: await bcrypt.hash('testPassword', saltRounds),
                firstname: 'Test',
                lastname: 'User',
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

        return queryInterface.bulkInsert('Users', users);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('Users', null, {});
    }
};
