const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ecommerce_platform'
};

async function verify() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);
        const [stores] = await connection.execute("SELECT id, name FROM stores WHERE name = 'Elite Superstore'");

        if (stores.length > 0) {
            const storeId = stores[0].id;
            const [products] = await connection.execute("SELECT count(*) as count FROM products WHERE store_id = ?", [storeId]);
            console.log(`Store: ${stores[0].name} (ID: ${storeId})`);
            console.log(`Product Count: ${products[0].count}`);

            const [items] = await connection.execute("SELECT name, price FROM products WHERE store_id = ?", [storeId]);
            console.log('Items:');
            items.forEach((item, idx) => {
                console.log(`${idx + 1}. ${item.name} - ${item.price} KES`);
            });
        } else {
            console.log("Store not found!");
        }
    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        if (connection) await connection.end();
    }
}
verify();
