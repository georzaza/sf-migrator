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
            projectId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'Projects',
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

        // Add unique constraint for project + source + target combination
        await queryInterface.addIndex('ObjectMappings', ['projectId', 'sourceObjectId', 'targetObjectId'], {
            unique: true,
            name: 'unique_project_mapping'
        });

        // Add index for faster lookups
        await queryInterface.addIndex('ObjectMappings', ['projectId']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('ObjectMappings');
    }
};
