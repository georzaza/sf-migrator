"use strict";

export default (sequelize, DataTypes) => {
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
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        label: {
            type: DataTypes.STRING(63),
            allowNull: false
        },
        labelPlural: {
            type: DataTypes.STRING(63),
            allowNull: true
        },
        custom: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        customSetting: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        keyPrefix: {
            type: DataTypes.STRING(3),
            allowNull: true
        },
        recordTypeInfos: {
            type: DataTypes.JSON,
            allowNull: true
        },
        recordCount: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        lastAnalyzed: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        extractFilter: {
            type: DataTypes.TEXT,
            allowNull: true
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

    };

    return SfObjectMetadata;
};
