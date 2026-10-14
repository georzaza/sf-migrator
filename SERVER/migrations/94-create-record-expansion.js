"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('RecordExpansions', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false,
            },
            sourceObjectId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'SfObjectMetadata', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            targetObjectId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'SfObjectMetadata', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            variants: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: [],
                comment: 'Array of { key, filter, fields } variant specs; each yields one target row.',
            },
            createdAt: { allowNull: false, type: Sequelize.DATE },
            updatedAt: { allowNull: false, type: Sequelize.DATE },
        });

        await queryInterface.sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "unique_record_expansion_object_pair"
            ON "RecordExpansions" ("sourceObjectId", "targetObjectId");
        `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "unique_record_expansion_object_pair";');
        await queryInterface.dropTable('RecordExpansions');
    },
};
