"use strict";

export default (sequelize, DataTypes) => {
    const ObjectMapping = sequelize.define('ObjectMapping', {
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
        mappingStatus: {
            type: DataTypes.ENUM('draft', 'validated', 'ready', 'in_progress', 'complete', 'failed'),
            allowNull: false,
            defaultValue: 'draft'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {});

    ObjectMapping.associate = function(models) {
        // Has a source object
        ObjectMapping.belongsTo(models.SfObjectMetadata, {
            foreignKey: 'sourceObjectId',
            as: 'sourceObject'
        });

        // Has a target object
        ObjectMapping.belongsTo(models.SfObjectMetadata, {
            foreignKey: 'targetObjectId',
            as: 'targetObject'
        });

        // Has many field mappings
        ObjectMapping.hasMany(models.FieldMapping, {
            foreignKey: 'objectMappingId',
            as: 'fieldMappings',
            onDelete: 'CASCADE'
        });

        // Has many migration jobs
        ObjectMapping.hasMany(models.MigrationJob, {
            foreignKey: 'objectMappingId',
            as: 'migrationJobs',
            onDelete: 'CASCADE'
        });
    };

    return ObjectMapping;
};
