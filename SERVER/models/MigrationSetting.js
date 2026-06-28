"use strict";

export default (sequelize, DataTypes) => {
    const MigrationSetting = sequelize.define('MigrationSetting', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        sourceObjectId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        targetObjectId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        enabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        batchSize: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 200
        },
        useBulkApi: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        operation: {
            type: DataTypes.ENUM('insert', 'upsert', 'update'),
            allowNull: false,
            defaultValue: 'insert'
        },
        sortToAvoidLocks: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        extractFilter: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Optional SOQL WHERE clause for extraction (stored only for now)'
        },
        externalIdStrategy: {
            type: DataTypes.ENUM('db-idmap'),
            allowNull: false,
            defaultValue: 'db-idmap'
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true
        }
    }, {
        indexes: [
            {
                unique: true,
                name: 'uq_migration_setting_object_pair',
                fields: ['sourceObjectId', 'targetObjectId']
            }
        ]
    });

    MigrationSetting.associate = function(models) {
        MigrationSetting.belongsTo(models.SfObjectMetadata, {
            foreignKey: 'sourceObjectId',
            as: 'sourceObject'
        });

        MigrationSetting.belongsTo(models.SfObjectMetadata, {
            foreignKey: 'targetObjectId',
            as: 'targetObject'
        });
    };

    return MigrationSetting;
};
