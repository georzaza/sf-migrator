"use strict";

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import SequelizePkg from 'sequelize';

const Sequelize = SequelizePkg;
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(path.join(__dirname, '..', 'config', 'config.cjs'))[env];
const db = {};

let sequelize;
if (config.use_env_variable)
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
else
    sequelize = new Sequelize(config.database, config.username, config.password, config);

const files = fs
    .readdirSync(__dirname)
    .filter(file => file !== basename && file.endsWith('.js') && !file.endsWith('.test.js'));

for (const file of files) {
    const modulePath = path.join(__dirname, file);
    const imported = await import(pathToFileURL(modulePath).href);
    const modelFactory = imported.default || imported;
    const model = modelFactory(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
}

for (const modelName of Object.keys(db)) {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
}

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
