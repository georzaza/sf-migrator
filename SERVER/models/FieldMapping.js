"use strict";

export default (sequelize, DataTypes) => {
    const FieldMapping = sequelize.define('FieldMapping', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        objectMappingId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        sourceFieldId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        targetFieldId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        mappingType: {
            type: DataTypes.ENUM('as-is', 'expression', 'constant'),
            allowNull: false,
            defaultValue: 'as-is'
        },
        transformationRule: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'JSON-encoded transformation rule (type, params, etc.)'
        },
        constantValue: {
            type: DataTypes.STRING,
            allowNull: true
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        validate: {
            mappingTypeValidation() {
                // If type is expression, must have transformationRule
                if (this.mappingType === 'expression' && !this.transformationRule) {
                    throw new Error('Transformation rule is required for expression mapping type');
                }
                // If type is constant, must have constantValue
                if (this.mappingType === 'constant' && !this.constantValue) {
                    throw new Error('Constant value is required for constant mapping type');
                }
                // If type is as-is, must have sourceFieldId
                if (this.mappingType === 'as-is' && !this.sourceFieldId) {
                    throw new Error('Source field ID is required for as-is mapping type');
                }
            }
        }
    });

    FieldMapping.associate = function(models) {
        // Belongs to an object mapping
        FieldMapping.belongsTo(models.ObjectMapping, {
            foreignKey: 'objectMappingId',
            as: 'objectMapping'
        });

        // Has a source field (optional for constant mappings)
        FieldMapping.belongsTo(models.SfFieldMetadata, {
            foreignKey: 'sourceFieldId',
            as: 'sourceField'
        });

        // Has a target field
        FieldMapping.belongsTo(models.SfFieldMetadata, {
            foreignKey: 'targetFieldId',
            as: 'targetField'
        });
    };

    return FieldMapping;
};
