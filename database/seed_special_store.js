const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
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
        const email = 'special_seller@example.com';
        const storeName = 'Elite Superstore';

        console.log('Checking if seller already exists...');
        const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);

        let userId;
        if (existing.length === 0) {
            const [result] = await connection.execute(
                'INSERT INTO users (email, password, name, user_type, phone, is_verified) VALUES (?, ?, ?, ?, ?, TRUE)',
                [email, password, 'Elite Seller', 'seller', '+254799999999']
            );
            userId = result.insertId;
            console.log(`Created seller user: ${email}`);
        } else {
            userId = existing[0].id;
            console.log(`User ${email} already exists (ID: ${userId})`);
        }

        console.log('Ensuring seller profile exists...');
        await connection.execute(
            'INSERT IGNORE INTO sellers (id, store_name, is_approved) VALUES (?, ?, TRUE)',
            [userId, storeName]
        );

        console.log('Ensuring store exists...');
        const [storeCheck] = await connection.execute('SELECT id FROM stores WHERE seller_id = ?', [userId]);
        let storeId;
        if (storeCheck.length === 0) {
            const [storeResult] = await connection.execute(
                `INSERT INTO stores (seller_id, name, category, address, latitude, longitude, is_open, description) 
                 VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
                [userId, storeName, 'electronics', 'Nairobi Technopark, Suite 10', -1.218, 36.885, 'Your one-stop shop for premium electronics and gadgets.']
            );
            storeId = storeResult.insertId;
            console.log(`Created store: ${storeName} (ID: ${storeId})`);
        } else {
            storeId = storeCheck[0].id;
            console.log(`Store already exists (ID: ${storeId})`);
        }

        console.log('Seeding 10 products...');
        const products = [
            { name: 'iPhone 15 Pro', price: 155000, desc: 'A17 Pro chip, Titanium design, 128GB' },
            { name: 'Samsung Galaxy S24', price: 110000, desc: 'AI-powered features, Triple camera system' },
            { name: 'MacBook Air M2', price: 165000, desc: 'Liquid Retina display, 8GB RAM, 256GB SSD' },
            { name: 'Sony WH-1000XM5', price: 45000, desc: 'Industry-leading noise canceling' },
            { name: 'iPad Pro M2', price: 140000, desc: '11-inch Liquid Retina display, Wi-Fi 6E' },
            { name: 'Nintendo Switch OLED', price: 55000, desc: '7-inch OLED screen, Vibrant colors' },
            { name: 'DJI Mini 3 Pro', price: 125000, desc: '4K/60fps Video, Under 249g' },
            { name: 'AirPods Pro (2nd Gen)', price: 35000, desc: 'Personalized Spatial Audio' },
            { name: 'Kindle Paperwhite', price: 22000, desc: 'Waterproof, 6.8" display, Adjustable warm light' },
            { name: 'Logitech MX Master 3S', price: 15000, desc: 'High-performance wireless mouse' }
        ];

        for (const product of products) {
            const [existingProd] = await connection.execute(
                'SELECT id FROM products WHERE store_id = ? AND name = ?',
                [storeId, product.name]
            );

            if (existingProd.length === 0) {
                await connection.execute(
                    `INSERT INTO products (store_id, name, description, price, category, image_urls, stock_quantity, is_available)
                     VALUES (?, ?, ?, ?, ?, ?, 50, TRUE)`,
                    [storeId, product.name, product.desc, product.price, 'Electronics', JSON.stringify(['/images/products/electronics.jpg'])]
                );
                console.log(`Added: ${product.name}`);
            } else {
                console.log(`Skipped (exists): ${product.name}`);
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
