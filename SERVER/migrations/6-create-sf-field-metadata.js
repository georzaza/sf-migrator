'use strict';

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
            fieldName: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Salesforce API name (e.g., Name, CustomField__c)'
            },
            fieldLabel: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Human-readable label'
            },
            dataType: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Field data type (string, number, date, boolean, etc.)'
            },
            length: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: 'Length for string/text fields'
            },
            isRequired: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            isCustom: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            picklistValues: {
                type: Sequelize.JSON,
                allowNull: true,
                comment: 'Array of picklist values if applicable'
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
        await queryInterface.addIndex('SfFieldMetadata', ['objectMetadataId', 'fieldName'], {
            unique: true,
            name: 'unique_object_field'
        });

        // Add index for faster lookups
        await queryInterface.addIndex('SfFieldMetadata', ['objectMetadataId']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('SfFieldMetadata');
    }
};
