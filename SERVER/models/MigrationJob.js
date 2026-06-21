"use strict";

export default (sequelize, DataTypes) => {
    const MigrationJob = sequelize.define('MigrationJob', {
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
        status: {
            type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'cancelled'),
            allowNull: false,
            defaultValue: 'pending'
        },
        recordsTotal: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        recordsProcessed: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        recordsSuccess: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        recordsFailed: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        startTime: {
            type: DataTypes.DATE,
            allowNull: true
        },
        endTime: {
            type: DataTypes.DATE,
            allowNull: true
        },
        errorLog: {
            type: DataTypes.JSON,
            allowNull: true
        }
    }, {});

    MigrationJob.associate = function(models) {
        MigrationJob.belongsTo(models.SfObjectMetadata, {
            foreignKey: 'sourceObjectId',
            as: 'sourceObject'
        });

        MigrationJob.belongsTo(models.SfObjectMetadata, {
            foreignKey: 'targetObjectId',
            as: 'targetObject'
        });
    };

    return MigrationJob;
};
