'use strict'

module.exports = (sequelize, DataTypes) => {
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
            type: DataTypes.ENUM('OAuth', 'Credentials'),
            allowNull: false,
            defaultValue: 'Credentials',
        },
        username: {
            type: DataTypes.STRING,
        },
        password: {
            type: DataTypes.STRING,
        },
        securityToken: {
            type: DataTypes.STRING,
        },
        clientId: {
            type: DataTypes.STRING,
        },
        clientSecret: {
            type: DataTypes.STRING,
        },
        projectId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Projects',
                key: 'id',
            }
        },
    }, {
        validate: {
            connectionTypeCheck() {
                if (this.connectionType === 'OAuth' && (!this.clientId || !this.clientSecret)) {
                    throw new Error('ClientId and ClientSecret are required for OAuth connection type.');
                }
                if (this.connectionType === 'Credentials' && (!this.username || !this.password || !this.securityToken)) {
                    throw new Error('Username, Password and SecurityToken are required for Credentials connection type.');
                }
            },
        }
    });

    SfOrg.associate = function(models) {
        SfOrg.belongsTo(models.Project, { foreignKey: 'projectId', as: 'project' });
    };

    return SfOrg;
}
