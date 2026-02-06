const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrate() {
    let connection;
    try {
        console.log('Connecting to database...');
        // Connect without database selected first to create it if needed
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true
        });

        console.log('Connected. Reading schema...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Split schema into two parts: 
        // 1. Standard SQL (before the first DELIMITER)
        // 2. Stored Procedures/Triggers (using DELIMITER)

        // This is a simplified parser specifically for the provided schema structure
        const delimiterSplit = schema.split('DELIMITER $$');

        // Part 1: Standard Tables and Constraints
        const standardSql = delimiterSplit[0];

        // Execute standard SQL statements (split by semicolon)
        // We clean comments and empty lines to avoid issues
        const statements = standardSql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);

        console.log(`Executing ${statements.length} standard statements...`);
        for (const stmt of statements) {
            try {
                await connection.query(stmt);
            } catch (err) {
                // Ignore "Database exists" or specific benign errors if you want
                // For now log valid errors
                if (err.code !== 'ER_DB_CREATE_EXISTS') {
                    console.error('Error executing statement:', stmt.substring(0, 50) + '...', err.message);
                }
            }
        }

        // Part 2: Advanced Logic (Triggers/Procedures)
        // Everything after the first delimiter declaration
        if (delimiterSplit.length > 1) {
            console.log('Executing advanced schema (Triggers/Procedures)...');

            // Re-select database just in case the first part didn't explicitly USE it in a way this connection tracks 
            // (though "USE" statement in SQL should work)
            await connection.changeUser({ database: process.env.DB_NAME });

            for (let i = 1; i < delimiterSplit.length; i++) {
                // The block looks like:
                // " CREATE TRIGGER ... END$$ DELIMITER ; "
                // We need to extract the part before "$$"
                const block = delimiterSplit[i];
                const parts = block.split('$$');

                if (parts.length > 0) {
                    const sql = parts[0].trim();
                    if (sql) {
                        try {
                            await connection.query(sql);
                            console.log('Created trigger/procedure.');
                        } catch (err) {
                            // Ignore "already exists" errors
                            if (err.code !== 'ER_SP_ALREADY_EXISTS' && err.code !== 'ER_TRG_ALREADY_EXISTS') {
                                console.error('Error executing block:', err.message);
                            }
                        }
                    }
                }
            }
        }

        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
