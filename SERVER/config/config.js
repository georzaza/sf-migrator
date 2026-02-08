const path = require('path');
const fs = require('fs');

const env = process.env.NODE_ENV || 'development';
const envFile = path.resolve(__dirname, `../.env.${env}`);

if (fs.existsSync(envFile)) {
    require('dotenv').config({ path: envFile });
}

const baseConfig = {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || `sf_migrator_${env}`,
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    logging: process.env.DB_LOGGING === 'true',
};

module.exports = {
    development: { ...baseConfig },
    test: { ...baseConfig },
    production: { ...baseConfig },
};
