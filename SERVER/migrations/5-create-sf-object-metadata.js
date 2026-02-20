'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('SfObjectMetadata', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            sfOrgId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'SfOrgs',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            name: {
                type: Sequelize.STRING(255),
                allowNull: false,
                comment: 'Salesforce API name (e.g., Account, CustomObject__c)'
            },
            label: {
                type: Sequelize.STRING(63),
                allowNull: false,
                comment: 'Human-readable label'
            },
            labelPlural: {
                type: Sequelize.STRING(63),
                allowNull: true
            },
            custom: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            customSetting: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            keyPrefix: {
                type: Sequelize.STRING(3),
                allowNull: true
            },
            recordTypeInfos: {
                type: Sequelize.JSON,
                allowNull: true,
                comment: 'Array of { name, developerName, active, master, recordTypeId }'
            },
            recordCount: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: 'Approximate number of records'
            },
            lastAnalyzed: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
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

        // Add unique constraint for org + object name combination
        await queryInterface.addIndex('SfObjectMetadata', ['sfOrgId', 'name'], {
            unique: true,
            name: 'unique_org_object'
        });

        // Add index for faster lookups
        await queryInterface.addIndex('SfObjectMetadata', ['sfOrgId']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('SfObjectMetadata');
    }
};
