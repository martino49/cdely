const db = require('./config/database');

async function fixDatabase() {
    try {
        console.log('Fixing database schema...');

        // 1. Add is_deleted to user_addresses
        try {
            await db.execute('ALTER TABLE user_addresses ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER is_default');
            console.log('Column "is_deleted" added to "user_addresses".');
        } catch (err) {
            if (err.code === 'ER_DUP_COLUMNNAME') {
                console.log('Column "is_deleted" already exists in "user_addresses".');
            } else {
                throw err;
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error fixing database:', error.message);
        process.exit(1);
    }
}

fixDatabase();
