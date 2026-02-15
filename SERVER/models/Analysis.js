/* todo
'use strict'

module.exports = (sequelize, DataTypes) => {
    const Analysis = sequelize.define('Analysis', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        orgId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'failed', 'superseded'),
            allowNull: false,
            defaultValue: 'pending',
        },
        progress: {
            type: DataTypes.JSON,
        },
        results: {
            type: DataTypes.JSON,
        },
        errorLog: {
            type: DataTypes.JSON,
        },
        startedAt: {
            type: DataTypes.DATE,
        },
        completedAt: {
            type: DataTypes.DATE,
        }
    }, {});

    Analysis.associate = function(models) {
        Analysis.belongsTo(models.SfOrg, { foreignKey: 'orgId', as: 'org' });
    };

    return Analysis;
}
*/
