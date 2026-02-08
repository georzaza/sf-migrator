'use strict';

module.exports = (sequelize, DataTypes) => {
    const ObjectMapping = sequelize.define('ObjectMapping', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        projectId: {
            type: DataTypes.UUID,
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
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {});

    ObjectMapping.associate = function(models) {
        // Belongs to a project
        ObjectMapping.belongsTo(models.Project, {
            foreignKey: 'projectId',
            as: 'project'
        });

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
