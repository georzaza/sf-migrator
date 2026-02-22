"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE "enum_FieldMappings_transformType" AS ENUM ('as-is', 'expression', 'constant');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryInterface.createTable('FieldMappings', {
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
            sourceFieldId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'SfFieldMetadata',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
                comment: 'Null for constant value mappings'
            },
            targetFieldId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'SfFieldMetadata',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            mappingType: {
                type: Sequelize.ENUM('as-is', 'expression', 'constant'),
                allowNull: false,
                defaultValue: 'as-is',
                comment: 'as-is: direct copy, expression: JS transformation, constant: static value'
            },
            transformExpression: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'JavaScript expression for transformation (e.g., "sourceField * 10")'
            },
            constantValue: {
                type: Sequelize.STRING,
                allowNull: true,
                comment: 'Static value for constant mapping type'
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
            CREATE INDEX IF NOT EXISTS "idx_field_mappings_objectMappingId"
            ON "FieldMappings" ("objectMappingId");
        `);
        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS "idx_field_mappings_sourceFieldId"
            ON "FieldMappings" ("sourceFieldId");
        `);
        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS "idx_field_mappings_targetFieldId"
            ON "FieldMappings" ("targetFieldId");
        `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "idx_field_mappings_objectMappingId";');
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "idx_field_mappings_sourceFieldId";');
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "idx_field_mappings_targetFieldId";');
        await queryInterface.dropTable('FieldMappings');
    }
};
