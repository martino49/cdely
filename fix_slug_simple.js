const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ecommerce_platform'
};

async function fix() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected.');

        console.log('Attempting to add slug column...');
        await connection.execute('ALTER TABLE stores ADD COLUMN slug VARCHAR(255) NOT NULL DEFAULT "temp-slug"');
        console.log('slug column added successfully.');

        // Remove default after
        await connection.execute('ALTER TABLE stores ALTER COLUMN slug DROP DEFAULT');
        console.log('slug default dropped.');

        // Add UNIQUE verification
        // await connection.execute('ALTER TABLE stores ADD UNIQUE (slug)');

    } catch (error) {
        console.error('ERROR:', error.message);
        console.error('Code:', error.code);
    } finally {
        if (connection) await connection.end();
    }
}

fix();
