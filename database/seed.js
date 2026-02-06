const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs'); // Assuming bcryptjs is installed as per package.json
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ecommerce_platform'
};

async function seed() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);

        const password = await bcrypt.hash('password123', 10);

        console.log('Seeding users...');

        const users = [
            // Admin
            { email: 'admin@example.com', password, name: 'System Admin', user_type: 'admin', phone: '+254700000000' },
            // Customer
            { email: 'customer@example.com', password, name: 'John Doe', user_type: 'customer', phone: '+254711111111' },
            // Seller
            { email: 'seller@example.com', password, name: 'Best Foods', user_type: 'seller', phone: '+254722222222' },
            // Rider
            { email: 'rider@example.com', password, name: 'Fast Rider', user_type: 'rider', phone: '+254733333333' }
        ];

        for (const user of users) {
            // Check if user exists
            const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [user.email]);

            let userId;
            if (existing.length === 0) {
                const [result] = await connection.execute(
                    'INSERT INTO users (email, password, name, user_type, phone, is_verified) VALUES (?, ?, ?, ?, ?, TRUE)',
                    [user.email, user.password, user.name, user.user_type, user.phone]
                );
                userId = result.insertId;
                console.log(`Created ${user.user_type}: ${user.email}`);
            } else {
                userId = existing[0].id;
                console.log(`User ${user.email} already exists`);
            }

            // Create related records
            if (user.user_type === 'customer') {
                await connection.execute(
                    'INSERT IGNORE INTO customers (id, loyalty_points) VALUES (?, ?)',
                    [userId, 100]
                );
            } else if (user.user_type === 'seller') {
                await connection.execute(
                    'INSERT IGNORE INTO sellers (id, store_name, is_approved) VALUES (?, ?, TRUE)',
                    [userId, 'Best Foods Store']
                );
                // Create a store for the seller
                await connection.execute(
                    `INSERT INTO stores (seller_name, category, address, latitude, longitude) 
                     SELECT 'Best Foods Store', 'food', 'Nairobi CBD', -1.286389, 36.817223 
                     FROM dual WHERE NOT EXISTS (SELECT * FROM stores WHERE seller_id = ?)`,
                    [userId] // Note: exact column mapping depends on schema, adjusting to schema.sql
                );
                // Actually schema says: seller_id, name, category...
                // Let's fix that query for stores
                const [storeCheck] = await connection.execute('SELECT id FROM stores WHERE seller_id = ?', [userId]);
                if (storeCheck.length === 0) {
                    await connection.execute(
                        `INSERT INTO stores (seller_id, name, category, address, latitude, longitude, is_open) 
                         VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
                        [userId, 'Best Foods Store', 'food', 'Nairobi CBD', -1.286389, 36.817223]
                    );
                }
            } else if (user.user_type === 'rider') {
                await connection.execute(
                    'INSERT IGNORE INTO riders (id, vehicle_type, status, is_approved) VALUES (?, ?, ?, TRUE)',
                    [userId, 'motorcycle', 'available']
                );
            }
        }


        // Seed Products for 'Best Foods Store' (assuming userId of seller is known or we find it)
        console.log('Seeding products...');

        // Find the store we just created/verified
        const [stores] = await connection.execute("SELECT id, seller_id FROM stores WHERE name = 'Best Foods Store' LIMIT 1");

        if (stores.length > 0) {
            const storeId = stores[0].id;

            const products = [
                {
                    name: 'Chicken Burger',
                    description: 'Delicious chicken burger with cheese and lettuce',
                    price: 450,
                    category: 'Fast Food',
                    image_urls: ['/images/products/burger.jpg']
                },
                {
                    name: 'Pepperoni Pizza',
                    description: 'Large pepperoni pizza with extra cheese',
                    price: 1200,
                    category: 'Fast Food',
                    image_urls: ['/images/products/pizza.jpg']
                },
                {
                    name: 'Grilled Chicken',
                    description: 'Whole grilled chicken with spices',
                    price: 800,
                    category: 'Food',
                    image_urls: ['/images/products/chicken.jpg']
                },
                {
                    name: 'French Fries',
                    description: 'Crispy salted french fries',
                    price: 200,
                    category: 'Fast Food',
                    image_urls: ['/images/products/fries.jpg']
                },
                {
                    name: 'Soda (500ml)',
                    description: 'Cold refreshing soda',
                    price: 100,
                    category: 'Drinks',
                    image_urls: ['/images/products/soda.jpg']
                }
            ];

            for (const product of products) {
                // Check if product exists
                const [existingProd] = await connection.execute(
                    'SELECT id FROM products WHERE store_id = ? AND name = ?',
                    [storeId, product.name]
                );

                if (existingProd.length === 0) {
                    await connection.execute(
                        `INSERT INTO products (store_id, name, description, price, category, image_urls, stock_quantity, is_available)
                         VALUES (?, ?, ?, ?, ?, ?, 100, TRUE)`,
                        [storeId, product.name, product.description, product.price, product.category, JSON.stringify(product.image_urls)]
                    );
                    console.log(`Created product: ${product.name}`);
                }
            }
        }

        console.log('Seeding completed successfully!');

    } catch (error) {
        console.error('Seeding failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

seed();
