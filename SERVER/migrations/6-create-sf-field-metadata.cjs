"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('SfFieldMetadata', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            objectMetadataId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'SfObjectMetadata',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            name: {
                type: Sequelize.STRING(255),
                allowNull: false,
                comment: 'Salesforce API name (e.g., Name, CustomField__c)'
            },
            label: {
                type: Sequelize.STRING(255),
                allowNull: false,
                comment: 'Human-readable label'
            },
            type: {
                type: Sequelize.STRING(63),
                allowNull: false,
                comment: 'Field data type (string, number, date, boolean, etc.)'
            },
            custom: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            autoNumber: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            unique: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            externalId: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            picklistValues: {
                type: Sequelize.JSON,
                allowNull: true,
                comment: 'Array of picklist values if applicable'
            },
            restrictedPicklist: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            dependentPicklist: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            calculated: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            calculatedFormula: {
                type: Sequelize.STRING(1023),
                allowNull: true
            },
            defaultedOnCreate: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            defaultValue: {
                type: Sequelize.STRING(255),
                allowNull: true,
                comment: 'May represent boolean, string, number, or null'
            },
            defaultValueFormula: {
                type: Sequelize.STRING(1023),
                allowNull: true
            },
            idLookup: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            relationshipName: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            referenceTo: {
                type: Sequelize.JSON,
                allowNull: true,
                comment: 'Array of referenced object API names'
            },
            nillable: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            byteLength: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            length: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: 'Length for string/text fields'
            },
            digits: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            scale: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            precision: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            encrypted: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            createable: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            updateable: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            compoundFieldName: {
                type: Sequelize.STRING(127),
                allowNull: true
            },
            inlineHelpText: {
                type: Sequelize.STRING(511),
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

        // Add unique constraint for object + field name combination
        await queryInterface.addIndex('SfFieldMetadata', ['objectMetadataId', 'name'], {
            unique: true,
            name: 'unique_object_field'
        });

        // Add index for faster lookups
        await queryInterface.addIndex('SfFieldMetadata', ['objectMetadataId']);

        await queryInterface.sequelize.query(`
            ALTER TABLE "SfFieldMetadata"
            ADD COLUMN "isFormula" BOOLEAN
                GENERATED ALWAYS AS (
                    calculated IS TRUE AND "calculatedFormula" IS NOT NULL
                ) STORED
        `);
        await queryInterface.sequelize.query(`
            ALTER TABLE "SfFieldMetadata"
            ADD COLUMN "isRollUpSummary" BOOLEAN
                GENERATED ALWAYS AS (
                    createable IS FALSE AND
                    calculated IS TRUE AND
                    "calculatedFormula" IS NULL AND
                    updateable IS FALSE
                ) STORED
        `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('SfFieldMetadata');
    }
};
