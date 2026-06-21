"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE "enum_FieldMappings_mappingType" AS ENUM ('as-is', 'expression', 'constant');
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
                comment: 'as-is: direct copy, expression: transformation, constant: static value'
            },
            transformationRule: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Transformation DSL in braces with field refs, || concatenation, and SUBSTR(expr,start,end)'
            },
            constantValue: {
                type: Sequelize.STRING,
                allowNull: true,
                comment: 'Static value for constant mapping type'
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

        // Unique constraint per object pair and field pair.
        await queryInterface.sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "unique_source_target_object_field_mapping"
            ON "FieldMappings" ("sourceObjectId", "targetObjectId", "sourceFieldId", "targetFieldId");
        `);

        // Index for querying by source-target object pair.
        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS "idx_field_mappings_source_target_object"
            ON "FieldMappings" ("sourceObjectId", "targetObjectId");
        `);

        // Index for querying by source field
        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS "idx_field_mappings_sourceFieldId"
            ON "FieldMappings" ("sourceFieldId");
        `);

        // Index for querying by target field
        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS "idx_field_mappings_targetFieldId"
            ON "FieldMappings" ("targetFieldId");
        `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "unique_source_target_object_field_mapping";');
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "idx_field_mappings_source_target_object";');
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "idx_field_mappings_sourceFieldId";');
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "idx_field_mappings_targetFieldId";');
        await queryInterface.dropTable('FieldMappings');
    }
};
