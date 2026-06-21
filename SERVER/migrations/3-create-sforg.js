"use strict";

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE "enum_SfOrgs_connectionType" AS ENUM ('OAuth');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryInterface.sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE "enum_SfOrgs_analysisStatus" AS ENUM ('idle', 'running', 'complete', 'failed', 'auth_required');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
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
                type: Sequelize.ENUM('OAuth'),
                allowNull: false,
                defaultValue: 'OAuth'
            },
            clientId: {
                type: Sequelize.STRING,
                allowNull: true
            },
            clientSecret: {
                type: Sequelize.STRING,
                allowNull: true
            },
            accessToken: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            refreshToken: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            instanceUrl: {
                type: Sequelize.STRING,
                allowNull: true
            },
            userId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'Users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            analysisStatus: {
                type: Sequelize.ENUM('idle', 'running', 'complete', 'failed', 'auth_required'),
                allowNull: false,
                defaultValue: 'idle'
            },
            analysisStartedAt: {
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
        await queryInterface.dropTable('SfOrgs');
        await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_SfOrgs_connectionType";`);
        await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_SfOrgs_analysisStatus";`);
    }
};
