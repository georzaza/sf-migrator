"use strict";

/**
 * RecordExpansion — object-level "explode" (record multiplication) transform.
 * One source record fans out into N target records. Each variant produces one
 * target row from its own set of field transform trees, optionally gated by a
 * boolean `filter` tree. See docs/TRANSFORMATIONS.md (Layer 2).
 *
 * variants JSONB shape:
 *   [
 *     {
 *       key: 'phone1',
 *       filter: <transform tree | null>,          // emit only when truthy
 *       fields: { '<TargetFieldApiName>': <transform tree>, ... }
 *     },
 *     ...
 *   ]
 */
export default (sequelize, DataTypes) => {
    const RecordExpansion = sequelize.define('RecordExpansion', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        sourceObjectId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        targetObjectId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        variants: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
            comment: 'Array of { key, filter, fields } variant specs; each yields one target row.',
        },
    });

    RecordExpansion.associate = function (models) {
        RecordExpansion.belongsTo(models.SfObjectMetadata, {
            foreignKey: 'sourceObjectId',
            as: 'sourceObject',
        });
        RecordExpansion.belongsTo(models.SfObjectMetadata, {
            foreignKey: 'targetObjectId',
            as: 'targetObject',
        });
    };

    return RecordExpansion;
};
