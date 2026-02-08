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
            defaultValue: 'OAuth',
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
                // Only enforce full credential validation on creation
                // Updates can be partial (frontend strips empty fields)
                if (this.isNewRecord) {
                    if (this.connectionType === 'OAuth') {
                        // OAuth requires all 5 credential fields
                        if (!this.username || !this.password || !this.securityToken || !this.clientId || !this.clientSecret) {
                            throw new Error('Username, Password, Security Token, Client ID, and Client Secret are all required for OAuth connection type.');
                        }
                    }
                    if (this.connectionType === 'Credentials') {
                        if (!this.username || !this.password || !this.securityToken) {
                            throw new Error('Username, Password and Security Token are required for Credentials connection type.');
                        }
                    }
                }
            },
        }
    });

    SfOrg.associate = function(models) {
        SfOrg.belongsTo(models.Project, { foreignKey: 'projectId', as: 'project' });
    };

    return SfOrg;
}
