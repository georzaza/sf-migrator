"use strict"

export default (sequelize, DataTypes) => {
    const SfOrg = sequelize.define('SfOrg', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT
        },
        loginURL: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        connectionType: {
            type: DataTypes.ENUM('OAuth'),
            allowNull: false,
            defaultValue: 'OAuth',
        },
        clientId: {
            type: DataTypes.STRING,
        },
        clientSecret: {
            type: DataTypes.STRING,
        },
        accessToken: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        refreshToken: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        instanceUrl: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id',
            }
        },
        analysisStatus: {
            type: DataTypes.ENUM('idle', 'running', 'complete', 'failed', 'auth_required'),
            allowNull: false,
            defaultValue: 'idle',
        },
        analysisStartedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        extractionStatus: {
            type: DataTypes.ENUM('idle', 'running', 'complete', 'failed', 'auth_failed'),
            allowNull: false,
            defaultValue: 'idle',
        },
        extractionSummary: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
        extractionError: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    });

    SfOrg.associate = function(models) {
        SfOrg.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    };

    return SfOrg;
}
