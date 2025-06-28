'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('SfOrgs', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('uuid_generate_v4()')
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            loginURL: {
                type: Sequelize.STRING,
                allowNull: false
            },
            connectionType: {
                type: Sequelize.ENUM('OAuth', 'Credentials'),
                allowNull: false,
                defaultValue: 'Credentials'
            },
            username: {
                type: Sequelize.STRING,
                allowNull: true
            },
            password: {
                type: Sequelize.STRING,
                allowNull: true
            },
            securityToken: {
                type: Sequelize.STRING,
                allowNull: true
            },
            clientId: {
                type: Sequelize.STRING,
                allowNull: true
            },
            clientSecret: {
                type: Sequelize.STRING,
                allowNull: true
            },
            projectId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'Projects',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
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
        await queryInterface.dropTable('SfOrgs');
    }
};
