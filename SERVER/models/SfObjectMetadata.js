'use strict';

module.exports = (sequelize, DataTypes) => {
    const SfObjectMetadata = sequelize.define('SfObjectMetadata', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        sfOrgId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        objectName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        objectLabel: {
            type: DataTypes.STRING,
            allowNull: false
        },
        isCustom: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        recordCount: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        lastAnalyzed: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {});

    SfObjectMetadata.associate = function(models) {
        // Belongs to SfOrg
        SfObjectMetadata.belongsTo(models.SfOrg, {
            foreignKey: 'sfOrgId',
            as: 'sfOrg'
        });

        // Has many fields
        SfObjectMetadata.hasMany(models.SfFieldMetadata, {
            foreignKey: 'objectMetadataId',
            as: 'fields',
            onDelete: 'CASCADE'
        });

        // Can be a source in many object mappings
        SfObjectMetadata.hasMany(models.ObjectMapping, {
            foreignKey: 'sourceObjectId',
            as: 'sourceMappings',
            onDelete: 'CASCADE'
        });

        // Can be a target in many object mappings
        SfObjectMetadata.hasMany(models.ObjectMapping, {
            foreignKey: 'targetObjectId',
            as: 'targetMappings',
            onDelete: 'CASCADE'
        });
    };

    return SfObjectMetadata;
};
