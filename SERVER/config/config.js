const path = require('path');
const fs = require('fs');

const env = process.env.NODE_ENV || 'development';

// load env variables into process.env from envFiles
const envFile = path.resolve(__dirname, `../.env.${env}`);
if (fs.existsSync(envFile)) {
    require('dotenv').config({ path: envFile });
}

const logging = process.env.DB_LOGGING === 'true' ? console.log : false;
const schema  = process.env.DB_SCHEMA || 'public';

const development = {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '9911',
    database: process.env.DB_NAME || `sf_migrator_${env}`,
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    logging,
    define: { schema },
    schema,
};

const test = {
    username: process.env.DB_USER || 'sf_migrator_test',
    password: process.env.DB_PASSWORD || '9911',
    database: process.env.DB_NAME || `sf_migrator_${env}`,
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    logging,
    define: { schema },
    schema,
};


const production = {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '9911',
    database: process.env.DB_NAME || `sf_migrator_${env}`,
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    logging,
    define: { schema },
    schema,
}

module.exports = {
    development: { ...development },
    test: { ...test },
    production: { ...production }
};
