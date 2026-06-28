"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE "enum_MigrationSettings_operation" AS ENUM ('insert', 'upsert', 'update');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryInterface.sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE "enum_MigrationSettings_externalIdStrategy" AS ENUM ('db-idmap');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryInterface.createTable('MigrationSettings', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            sourceObjectId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'SfObjectMetadata',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            targetObjectId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'SfObjectMetadata',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            enabled: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
            batchSize: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 200
            },
            useBulkApi: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
            operation: {
                type: Sequelize.ENUM('insert', 'upsert', 'update'),
                allowNull: false,
                defaultValue: 'insert'
            },
            sortToAvoidLocks: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            extractFilter: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Optional SOQL WHERE clause for extraction (stored only for now)'
            },
            externalIdStrategy: {
                type: Sequelize.ENUM('db-idmap'),
                allowNull: false,
                defaultValue: 'db-idmap'
            },
            metadata: {
                type: Sequelize.JSONB,
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

        await queryInterface.sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_migration_setting_object_pair"
            ON "MigrationSettings" ("sourceObjectId", "targetObjectId");
        `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "uq_migration_setting_object_pair";');
        await queryInterface.dropTable('MigrationSettings');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_MigrationSettings_operation";');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_MigrationSettings_externalIdStrategy";');
    }
};
