"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('ObjectMappings', {
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
                onDelete: 'CASCADE',
                comment: 'Source Salesforce object'
            },
            targetObjectId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'SfObjectMetadata',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                comment: 'Target Salesforce object'
            },
            mappingStatus: {
                type: Sequelize.ENUM('draft', 'validated', 'ready', 'in_progress', 'complete', 'failed'),
                allowNull: false,
                defaultValue: 'draft',
                comment: 'Tracks the state of the mapping workflow'
            },
            isActive: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
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

        // Unique constraint: each source object can only be mapped to a target object once
        // Note: sourceObjectId already includes org info (via SfObjectMetadata.sfOrgId)
        await queryInterface.sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "unique_source_target_mapping"
            ON "ObjectMappings" ("sourceObjectId", "targetObjectId");
        `);

        // Index for querying by source object
        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS "idx_object_mappings_sourceObjectId"
            ON "ObjectMappings" ("sourceObjectId");
        `);

        // Index for querying by target object
        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS "idx_object_mappings_targetObjectId"
            ON "ObjectMappings" ("targetObjectId");
        `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "unique_source_target_mapping";');
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "idx_object_mappings_sourceObjectId";');
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "idx_object_mappings_targetObjectId";');
        await queryInterface.dropTable('ObjectMappings');
    }
};
