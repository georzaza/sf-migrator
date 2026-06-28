"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('RecordIdMaps', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            sourceOrgId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'SfOrgs',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            targetOrgId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'SfOrgs',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            objectName: {
                type: Sequelize.STRING(255),
                allowNull: false,
                comment: 'Source object API name the record belongs to'
            },
            sourceRecordId: {
                type: Sequelize.STRING(18),
                allowNull: false,
                comment: 'Salesforce record Id in the source org'
            },
            targetRecordId: {
                type: Sequelize.STRING(18),
                allowNull: true,
                comment: 'Salesforce record Id in the target org, populated after load'
            },
            migrationJobId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'MigrationJobs',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
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
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_record_id_map_source_key"
            ON "RecordIdMaps" ("sourceOrgId", "targetOrgId", "objectName", "sourceRecordId");
        `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS "uq_record_id_map_source_key";');
        await queryInterface.dropTable('RecordIdMaps');
    }
};
