'use strict';

module.exports = (sequelize, DataTypes) => {
    const SfFieldMetadata = sequelize.define('SfFieldMetadata', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        objectMetadataId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        fieldName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        fieldLabel: {
            type: DataTypes.STRING,
            allowNull: false
        },
        dataType: {
            type: DataTypes.STRING,
            allowNull: false
        },
        length: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        isRequired: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        isCustom: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        picklistValues: {
            type: DataTypes.JSON,
            allowNull: true
        }
    }, {});

    SfFieldMetadata.associate = function(models) {
        // Belongs to an object
        SfFieldMetadata.belongsTo(models.SfObjectMetadata, {
            foreignKey: 'objectMetadataId',
            as: 'object'
        });

        // Can be a source in many field mappings
        SfFieldMetadata.hasMany(models.FieldMapping, {
            foreignKey: 'sourceFieldId',
            as: 'sourceMappings',
            onDelete: 'SET NULL'
        });

        // Can be a target in many field mappings
        SfFieldMetadata.hasMany(models.FieldMapping, {
            foreignKey: 'targetFieldId',
            as: 'targetMappings',
            onDelete: 'CASCADE'
        });
    };

    return SfFieldMetadata;
};
