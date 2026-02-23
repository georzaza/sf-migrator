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

        await queryInterface.sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "unique_user_mapping"
            ON "ObjectMappings" ("userId", "sourceObjectId", "targetObjectId");
        `);

        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS "idx_object_mappings_userId"
            ON "ObjectMappings" ("userId");
        `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "unique_user_mapping";');
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "idx_object_mappings_userId";');
        await queryInterface.dropTable('ObjectMappings');
    }
};
