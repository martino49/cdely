const db = require('./config/database');

async function fixCartsTable() {
    try {
        console.log('Fixing "carts" table...');

        // Add special_instructions column
        const alterTableQuery = 'ALTER TABLE carts ADD COLUMN special_instructions TEXT AFTER quantity';

        await db.execute(alterTableQuery);
        console.log('Column "special_instructions" added successfully.');

        process.exit(0);
    } catch (error) {
        if (error.code === 'ER_DUP_COLUMNNAME') {
            console.log('Column "special_instructions" already exists.');
            process.exit(0);
        }
        console.error('Error fixing table:', error.message);
        process.exit(1);
    }
}

fixCartsTable();
