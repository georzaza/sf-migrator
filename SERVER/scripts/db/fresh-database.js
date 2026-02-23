#!/usr/bin/env node
/**
 * Fresh Database Setup Script
 *
 * Completely rebuilds the database from scratch by:
 * 1. Undoing all migrations (drops all tables)
 * 2. Running all migrations (recreates schema)
 * 3. Seeding the database with initial data
 *
 * ⚠️ WARNING: This will DELETE ALL DATA in the database!
 *
 * Usage:
 *   node scripts/db/fresh-database.js [environment]
 *
 * Examples:
 *   node scripts/db/fresh-database.js dev
 *   node scripts/db/fresh-database.js test
 *   node scripts/db/fresh-database.js prod
 *
 * Or use npm scripts:
 *   npm run fresh:dev
 *   npm run fresh:test
 *   npm run fresh:prod
 */

const { execSync } = require('child_process');
const path = require('path');
const readline = require('readline');

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

const dbName = `sf_migrator_${normalizedEnv === 'development' ? 'dev' : normalizedEnv}`;

console.log('\n===========================================');
console.log(`⚠️  FRESH DATABASE SETUP`);
console.log('===========================================');
console.log(`Environment: ${normalizedEnv}`);
console.log(`Database: ${dbName}`);
console.log('\n⚠️  WARNING: This will DELETE ALL DATA!\n');

// Ask for confirmation in production
if (normalizedEnv === 'production') {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Are you sure you want to reset the PRODUCTION database? (yes/no): ', (answer) => {
        rl.close();
        if (answer.toLowerCase() !== 'yes') {
            console.log('Aborted.');
            process.exit(0);
        }
        runFreshSetup();
    });
} else {
    runFreshSetup();
}

function runFreshSetup() {
    console.log('\n🚀 Starting fresh database setup...\n');

    const steps = [
        { name: 'Undoing all migrations', cmd: `cross-env NODE_ENV=${normalizedEnv} npx sequelize-cli db:migrate:undo:all` },
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
        console.log(`✅ Fresh database setup completed!`);
        console.log('===========================================\n');
        console.log(`Database: ${dbName}`);
        console.log(`Environment: ${normalizedEnv}`);
        console.log('\nDatabase contains:');
        console.log('  ✓ 1 user (georzaza_${normalizedEnv === "development" ? "dev" : normalizedEnv})');
        console.log('  ✓ 2 orgs per user (real Salesforce orgs)');
        console.log('    - Superbadge: Formulas');
        console.log('    - Superbadge: Apex Web Services');
        console.log('\n');

    } catch (error) {
        console.error('\n❌ Fresh database setup failed!');
        console.error(error.message);
        process.exit(1);
    }
}
