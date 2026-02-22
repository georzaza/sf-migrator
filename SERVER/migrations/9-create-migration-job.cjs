"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE "enum_MigrationJobs_status" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryInterface.createTable('MigrationJobs', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            objectMappingId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'ObjectMappings',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            status: {
                type: Sequelize.ENUM('pending', 'running', 'completed', 'failed', 'cancelled'),
                allowNull: false,
                defaultValue: 'pending'
            },
            recordsTotal: {
                type: Sequelize.INTEGER,
                allowNull: true,
                defaultValue: 0,
                comment: 'Total number of records to migrate'
            },
            recordsProcessed: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Number of records processed'
            },
            recordsSuccess: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Number of records successfully migrated'
            },
            recordsFailed: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Number of records that failed to migrate'
            },
            startTime: {
                type: Sequelize.DATE,
                allowNull: true
            },
            endTime: {
                type: Sequelize.DATE,
                allowNull: true
            },
            errorLog: {
                type: Sequelize.JSON,
                allowNull: true,
                comment: 'Array of error objects with details'
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

        // Add index for faster status lookups
        await queryInterface.addIndex('MigrationJobs', ['status']);
        await queryInterface.addIndex('MigrationJobs', ['objectMappingId']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('MigrationJobs');
    }
};
