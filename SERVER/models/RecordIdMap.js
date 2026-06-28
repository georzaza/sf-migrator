"use strict";

export default (sequelize, DataTypes) => {
    const RecordIdMap = sequelize.define('RecordIdMap', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        sourceOrgId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        targetOrgId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        objectName: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: 'Source object API name the record belongs to'
        },
        sourceRecordId: {
            type: DataTypes.STRING(18),
            allowNull: false,
            comment: 'Salesforce record Id in the source org'
        },
        targetRecordId: {
            type: DataTypes.STRING(18),
            allowNull: true,
            comment: 'Salesforce record Id in the target org, populated after load'
        },
        migrationJobId: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: 'Migration job that populated the target record Id'
        }
    }, {
        indexes: [
            {
                unique: true,
                name: 'uq_record_id_map_source_key',
                fields: ['sourceOrgId', 'targetOrgId', 'objectName', 'sourceRecordId']
            }
        ]
    });

    RecordIdMap.associate = function(models) {
        RecordIdMap.belongsTo(models.SfOrg, {
            foreignKey: 'sourceOrgId',
            as: 'sourceOrg'
        });

        RecordIdMap.belongsTo(models.SfOrg, {
            foreignKey: 'targetOrgId',
            as: 'targetOrg'
        });

        RecordIdMap.belongsTo(models.MigrationJob, {
            foreignKey: 'migrationJobId',
            as: 'migrationJob'
        });
    };

    return RecordIdMap;
};
