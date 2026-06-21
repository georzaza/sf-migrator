"use strict";

export default (sequelize, DataTypes) => {
    const FieldMapping = sequelize.define('FieldMapping', {
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
            comment: 'Transformation DSL in braces. Supports field references, concatenation with ||, and SUBSTR(expr,start,end).'
        },
        constantValue: {
            type: DataTypes.STRING,
            allowNull: true
        },
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
        // Belongs to a source object
        FieldMapping.belongsTo(models.SfObjectMetadata, {
            foreignKey: 'sourceObjectId',
            as: 'sourceObject'
        });

        // Belongs to a target object
        FieldMapping.belongsTo(models.SfObjectMetadata, {
            foreignKey: 'targetObjectId',
            as: 'targetObject'
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
