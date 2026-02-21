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
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        label: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        type: {
            type: DataTypes.STRING(63),
            allowNull: false
        },
        custom: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        autoNumber: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        unique: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        externalId: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        picklistValues: {
            type: DataTypes.JSON,
            allowNull: true
        },
        restrictedPicklist: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        dependentPicklist: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        calculated: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        calculatedFormula: {
            type: DataTypes.STRING(1023),
            allowNull: true
        },
        defaultedOnCreate: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        defaultValue: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        defaultValueFormula: {
            type: DataTypes.STRING(1023),
            allowNull: true
        },
        idLookup: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        relationshipName: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        referenceTo: {
            type: DataTypes.JSON,
            allowNull: true
        },
        nillable: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        byteLength: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        length: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        digits: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        scale: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        precision: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        encrypted: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        createable: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        updateable: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        compoundFieldName: {
            type: DataTypes.STRING(127),
            allowNull: true
        },
        inlineHelpText: {
            type: DataTypes.STRING(511),
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
