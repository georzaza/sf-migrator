/**
 * List all tables in the database
 *
 * Usage: node scripts/db/check-tables.js
 */

const { sequelize } = require('../../models');

(async () => {
    try {
        const [results] = await sequelize.query(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        );

        console.log('\nTables in database:', sequelize.config.database);
        console.log('='.repeat(50));
        if (results.length === 0) {
            console.log('   No tables found!');
        } else {
            results.forEach(row => console.log(`   - ${row.tablename}`));
        }
        console.log('='.repeat(50));
        console.log(`   Total: ${results.length} tables\n`);

        await sequelize.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();
