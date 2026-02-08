#!/usr/bin/env node
/**
 * Database Reset Script
 *
 * Automatically resets the database by:
 * 1. Undoing all seeders
 * 2. Running migrations
 * 3. Reseeding the database
 *
 * Usage:
 *   node scripts/db/reset-database.js [environment]
 *
 * Examples:
 *   node scripts/db/reset-database.js dev
 *   node scripts/db/reset-database.js test
 *   node scripts/db/reset-database.js prod
 *
 * Or use npm scripts:
 *   npm run reset:dev
 *   npm run reset:test
 *   npm run reset:prod
 */

const { execSync } = require('child_process');
const path = require('path');

// Get environment from command line or default to development
const env = process.argv[2] || process.env.NODE_ENV || 'development';
const validEnvs = ['development', 'dev', 'test', 'production', 'prod'];

// Normalize environment name
let normalizedEnv = env.toLowerCase();
if (normalizedEnv === 'dev') normalizedEnv = 'development';
if (normalizedEnv === 'prod') normalizedEnv = 'production';

if (!validEnvs.includes(env.toLowerCase())) {
    console.error(`Invalid environment: ${env}`);
    console.error(`Valid environments: development, dev, test, production, prod`);
    process.exit(1);
}

// Load environment variables
require('dotenv').config({
    path: path.resolve(__dirname, `../../.env.${normalizedEnv}`)
});

console.log('\n===========================================');
console.log(`🔄 Resetting ${normalizedEnv} database...`);
console.log('===========================================\n');

const steps = [
    { name: 'Undoing seeders', cmd: `cross-env NODE_ENV=${normalizedEnv} npx sequelize-cli db:seed:undo:all` },
    { name: 'Running migrations', cmd: `cross-env NODE_ENV=${normalizedEnv} npx sequelize-cli db:migrate` },
    { name: 'Seeding database', cmd: `cross-env NODE_ENV=${normalizedEnv} npx sequelize-cli db:seed:all` }
];

try {
    for (const step of steps) {
        console.log(`\n📋 ${step.name}...`);
        console.log('-------------------------------------------');
        execSync(step.cmd, {
            stdio: 'inherit',
            cwd: path.resolve(__dirname, '../..')
        });
        console.log(`✅ ${step.name} completed\n`);
    }

    console.log('\n===========================================');
    console.log(`✅ Database reset completed successfully!`);
    console.log('===========================================\n');
    console.log(`Database: sf_migrator_${normalizedEnv === 'development' ? 'dev' : normalizedEnv}`);
    console.log(`Environment: ${normalizedEnv}`);
    console.log('\n');

} catch (error) {
    console.error('\n❌ Database reset failed!');
    console.error(error.message);
    process.exit(1);
}
