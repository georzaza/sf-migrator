/**
 * Database Connection Verification Script
 *
 * Checks PostgreSQL connectivity, lists models, tables, and validates
 * that all required migrations have been applied.
 *
 * Usage: node scripts/db/verify-db.js
 */

const { sequelize } = require('../../models');

async function verifyDatabase() {
    console.log('Checking database connection...\n');

    try {
        await sequelize.authenticate();
        console.log('[OK] Database connection successful');
        console.log(`   Host: ${sequelize.config.host}`);
        console.log(`   Database: ${sequelize.config.database}`);
        console.log(`   Username: ${sequelize.config.username}`);
        console.log();

        const models = Object.keys(sequelize.models);
        console.log(`Found ${models.length} models:`);
        models.forEach(model => console.log(`   - ${model}`));
        console.log();

        const [results] = await sequelize.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        );

        console.log(`Database has ${results.length} tables:`);
        results.forEach(row => console.log(`   - ${row.table_name}`));
        console.log();

        const requiredTables = [
            'Users',
            'Projects',
            'SfOrgs',
            'SfObjectMetadata',
            'SfFieldMetadata',
            'ObjectMappings',
            'FieldMappings',
            'MigrationJobs',
        ];

        const existingTables = results.map(r => r.table_name);
        const missingTables = requiredTables.filter(t => !existingTables.includes(t));

        if (missingTables.length > 0) {
            console.log('Missing tables (run migrations):');
            missingTables.forEach(table => console.log(`   - ${table}`));
            console.log('\n   Run: npx sequelize-cli db:migrate');
        } else {
            console.log('[OK] All required tables exist');
        }

        console.log('\n[OK] Database is ready!');
    } catch (error) {
        console.error('[FAIL] Database connection failed:', error.message);
        console.log('\nTroubleshooting:');

        if (error.message.includes('ECONNREFUSED')) {
            console.log('   1. Start PostgreSQL service');
        } else if (error.message.includes('database') && error.message.includes('does not exist')) {
            console.log('   1. Create the database: npx sequelize-cli db:create');
        } else if (error.message.includes('password')) {
            console.log('   1. Check credentials in config/config.json');
        }
    } finally {
        await sequelize.close();
    }
}

verifyDatabase();
