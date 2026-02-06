const db = require('../config/database');
const bcrypt = require('bcryptjs');

async function seed() {
    try {
        console.log('Starting comprehensive seeding...');

        // 1. Ensure a Seller User exists
        let [sellers] = await db.execute('SELECT id FROM users WHERE user_type = "seller" LIMIT 1');
        let sellerId;

        if (sellers.length === 0) {
            console.log('Creating a sample seller user...');
            const hashedPassword = await bcrypt.hash('password123', 10);
            const [userResult] = await db.execute(
                `INSERT INTO users (email, password, phone, user_type, name, is_verified) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                ['seller@example.com', hashedPassword, '0711222333', 'seller', 'John Seller', 1]
            );
            sellerId = userResult.insertId;

            // Create record in sellers table
            await db.execute(
                `INSERT INTO sellers (id, store_name, is_approved) VALUES (?, ?, ?)`,
                [sellerId, 'KFC Westlands Official', 1]
            );
        } else {
            sellerId = sellers[0].id;
        }

        // 2. Ensure a Store exists for that seller
        let [stores] = await db.execute('SELECT id FROM stores WHERE seller_id = ? LIMIT 1', [sellerId]);
        let storeId;

        if (stores.length === 0) {
            console.log('Creating a sample store...');
            const [storeResult] = await db.execute(
                `INSERT INTO stores (seller_id, name, category, address, latitude, longitude, logo_url, rating) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [sellerId, 'KFC Westlands', 'food', 'Westlands, Nairobi', -1.2646, 36.8045, 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/KFC_logo.svg/1200px-KFC_logo.svg.png', 4.5]
            );
            storeId = storeResult.insertId;
        } else {
            storeId = stores[0].id;
        }

        // 3. Ensure some Products exist for that store
        let [products] = await db.execute('SELECT id, price FROM products WHERE store_id = ? LIMIT 5', [storeId]);

        if (products.length === 0) {
            console.log('Creating sample products...');
            const sampleProducts = [
                ['Zinger Burger', 'Classic spicy chicken burger', 550, 'https://images.deliveryhero.io/image/fd-sg/Products/2582.jpg'],
                ['Original Recipe Chicken (2pc)', 'KFC classic chicken', 450, 'https://images.deliveryhero.io/image/fd-sg/Products/2581.jpg']
            ];

            for (const p of sampleProducts) {
                await db.execute(
                    `INSERT INTO products (store_id, name, description, price, image_urls, stock_quantity) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [storeId, p[0], p[1], p[2], JSON.stringify([p[3]]), 100]
                );
            }
            [products] = await db.execute('SELECT id, price FROM products WHERE store_id = ? LIMIT 5', [storeId]);
        }

        // 4. Ensure a Customer exists
        const [customers] = await db.execute('SELECT id FROM users WHERE user_type = "customer" LIMIT 1');
        if (customers.length === 0) {
            console.log('No customer found. Please register as a customer first.');
            return;
        }
        const customerId = customers[0].id;

        // Ensure record in customers table
        const [customerExists] = await db.execute('SELECT id FROM customers WHERE id = ?', [customerId]);
        if (customerExists.length === 0) {
            await db.execute('INSERT INTO customers (id) VALUES (?)', [customerId]);
        }

        // 5. Seed 10 Orders
        console.log(`Seeding 10 orders for customer ID: ${customerId}`);
        const statuses = ['pending', 'preparing', 'ready_for_pickup', 'delivered', 'cancelled'];
        const paymentMethods = ['cash', 'card', 'mobile_money'];

        for (let i = 1; i <= 10; i++) {
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const subtotal = products[0].price * (Math.floor(Math.random() * 3) + 1);
            const total = subtotal + 200; // subtotal + fee
            const orderNumber = 'ORD-' + Date.now() + i;

            const [orderResult] = await db.execute(
                `INSERT INTO orders (
                    order_number, customer_id, store_id, order_status, 
                    subtotal, delivery_fee, platform_fee, total_amount, 
                    payment_method, delivery_address
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderNumber, customerId, storeId, status,
                    subtotal, 150, 50, total,
                    paymentMethods[Math.floor(Math.random() * 3)],
                    'Nairobi, Kenya'
                ]
            );

            await db.execute(
                `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) 
                 VALUES (?, ?, ?, ?, ?)`,
                [orderResult.insertId, products[0].id, 1, products[0].price, products[0].price]
            );
        }

        console.log('Success! Created a seller, a store, products, and 10 sample orders.');
        process.exit(0);
    } catch (error) {
        console.error('CRITICAL SEEDING ERROR:', error);
        process.exit(1);
    }
}

seed();
