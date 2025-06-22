'use strict';

module.exports = (sequelize, DataTypes) => {
    const Project = sequelize.define('Project', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false
        }
    }, {});

    Project.associate = function(models) {
        Project.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    };

    return Project;
};
