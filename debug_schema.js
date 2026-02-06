const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ecommerce_platform'
};

async function diagnose() {
    let connection;
    try {
        console.log('Connecting to database:', dbConfig.database, 'at', dbConfig.host);
        connection = await mysql.createConnection(dbConfig);

        console.log('Successfully connected.');

        console.log('Fetching columns for "stores" table...');
        const [rows] = await connection.execute('SHOW COLUMNS FROM stores');
        const columns = rows.map(r => r.Field);
        console.log('Current Columns:', columns);

        if (!columns.includes('slug')) {
            console.error('CRITICAL: "slug" column is MISSING!');
            console.log('Attempting to add "slug" column NOW...');
            try {
                await connection.execute('ALTER TABLE stores ADD COLUMN slug VARCHAR(255) NOT NULL UNIQUE AFTER name');
                console.log('SUCCESS: "slug" column added.');
            } catch (alterError) {
                console.error('FAILED to add "slug" column:', alterError.message);
            }
        } else {
            console.log('OK: "slug" column exists.');
        }

        if (!columns.includes('is_approved')) {
            console.error('CRITICAL: "is_approved" column is MISSING!');
            console.log('Attempting to add "is_approved" column NOW...');
            try {
                await connection.execute('ALTER TABLE stores ADD COLUMN is_approved BOOLEAN DEFAULT FALSE');
                console.log('SUCCESS: "is_approved" column added.');
            } catch (alterError) {
                console.error('FAILED to add "is_approved" column:', alterError.message);
            }
        } else {
            console.log('OK: "is_approved" column exists.');
        }

    } catch (error) {
        console.error('Database Connection Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

diagnose();
