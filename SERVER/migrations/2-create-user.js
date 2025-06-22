'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('Users', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('uuid_generate_v4()')
            },
            email: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            password: {
                type: Sequelize.STRING,
                allowNull: false
            },
            firstname: {
                type: Sequelize.STRING,
                allowNull: false
            },
            lastname: {
                type: Sequelize.STRING,
                allowNull: false
            },
            username: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
                validate: {
                    len: [3, 32],
                    is: /^[a-zA-Z0-9_.]+$/i // only letters, numbers, underscore, dot
                }
            },
            role: {
                type: Sequelize.ENUM('admin', 'user'),
                defaultValue: 'user',
                allowNull: false
            },
            isActive: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            emailVerified: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            lastLogin: {
                type: Sequelize.DATE,
                allowNull: true
            },
            resetPasswordToken: {
                type: Sequelize.STRING,
                allowNull: true
            },
            resetPasswordExpires: {
                type: Sequelize.DATE,
                allowNull: true
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('Users');
    }
};
