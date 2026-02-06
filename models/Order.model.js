const db = require('../config/database');
const { generateOrderNumber } = require('../utils/generators');

class Order {
    // Create new order
    static async create(orderData) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Create order
            const [orderResult] = await connection.execute(
                `INSERT INTO orders (
                    customer_id, store_id, subtotal, delivery_fee, 
                    platform_commission, total_amount, payment_method, 
                    delivery_address, delivery_latitude, delivery_longitude
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderData.customer_id || null,
                    orderData.store_id || null,
                    orderData.subtotal || 0,
                    orderData.delivery_fee || 0,
                    (orderData.subtotal || 0) * 0.10, // Platform fee calculation
                    orderData.total_amount || 0,
                    orderData.payment_method || 'mobile_money',
                    orderData.delivery_address || '',
                    orderData.delivery_lat || null,
                    orderData.delivery_lng || null
                ]
            );

            const orderId = orderResult.insertId;

            // Add order items
            for (const item of orderData.items) {
                await connection.execute(
                    `INSERT INTO order_items (
                        order_id, product_id, quantity, 
                        unit_price, total_price, special_instructions
                    ) VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        orderId,
                        item.product_id || null,
                        item.quantity || 1,
                        item.unit_price || 0,
                        item.total_price || 0,
                        item.special_instructions || null
                    ]
                );
            }

            // Clear customer's cart
            await connection.execute(
                'DELETE FROM shopping_carts WHERE customer_id = ? AND store_id = ?',
                [orderData.customer_id || null, orderData.store_id || null]
            );

            // Create platform fee record - REMOVED as table does not exist
            // Platform commission is now set directly in the orders table

            await connection.commit();
            return orderId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Find order by ID
    static async findById(id, userId = null, userType = null) {
        let query = `
            SELECT o.*, 
                s.name as store_name, s.logo_url as store_logo,
                c.full_name as customer_name, c.phone as customer_phone,
                r.full_name as rider_name, r.phone as rider_phone,
                o.order_status as delivery_status, o.estimated_delivery_time
            FROM orders o
            LEFT JOIN stores s ON o.store_id = s.id
            LEFT JOIN users c ON o.customer_id = c.id
            LEFT JOIN users r ON o.rider_id = r.id
            WHERE o.id = ?
        `;

        const params = [id || null];

        // Add access control based on user type
        if (userId && userType) {
            if (userType === 'customer') {
                query += ' AND o.customer_id = ?';
                params.push(userId);
            } else if (userType === 'seller') {
                query += ' AND s.seller_id = ?';
                params.push(userId);
            } else if (userType === 'rider') {
                query += ' AND o.rider_id = ?';
                params.push(userId);
            }
        }

        const [rows] = await db.execute(query, params);
        return rows[0];
    }

    // Get order items
    static async getOrderItems(orderId) {
        const [rows] = await db.execute(
            `SELECT oi.*, p.name as product_name, p.image_urls 
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?`,
            [orderId]
        );
        return rows;
    }

    // Update order status
    static async updateStatus(orderId, status, notes = null) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Update order status
            const [result] = await connection.execute(
                `UPDATE orders 
                 SET order_status = ?, 
                     updated_at = CURRENT_TIMESTAMP
                     ${notes ? ', seller_notes = ?' : ''}
                 WHERE id = ?`,
                notes ? [status || null, notes, orderId || null] : [status || null, orderId || null]
            );

            // Get order details for notification
            const [orderRows] = await connection.execute(
                `SELECT o.*, c.email as customer_email, c.full_name as customer_name
                 FROM orders o
                 JOIN users c ON o.customer_id = c.id
                 WHERE o.id = ?`,
                [orderId]
            );

            const order = orderRows[0];

            // Create notification
            if (order) {
                await connection.execute(
                    `INSERT INTO notifications 
                     (user_id, type, title, message, data)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        order.customer_id || null,
                        'order_status_update',
                        'Order Status Updated',
                        `Your order #${order.order_number} is now ${status.replace('_', ' ')}`,
                        JSON.stringify({ order_id: orderId, status })
                    ]
                );
            }

            // If status is 'ready_for_pickup', assign rider
            if (status === 'ready_for_pickup') {
                const [storeRows] = await connection.execute(
                    'SELECT latitude, longitude FROM stores WHERE id = ?',
                    [order.store_id || null]
                );

                if (storeRows[0]) {
                    const store = storeRows[0];
                    // Call stored procedure to assign rider
                    const [riderRows] = await connection.execute(
                        'CALL AssignRiderToOrder(?, ?, ?)',
                        [orderId || null, store.latitude || 0, store.longitude || 0]
                    );

                    if (riderRows[0] && riderRows[0][0]) {
                        const riderId = riderRows[0][0].rider_id;

                        // Notify rider
                        await connection.execute(
                            `INSERT INTO notifications 
                             (user_id, type, title, message, data)
                             VALUES (?, ?, ?, ?, ?)`,
                            [
                                riderId,
                                'rider_assigned',
                                'New Delivery Assignment',
                                `You have been assigned to deliver order #${order.order_number}`,
                                JSON.stringify({ order_id: orderId, store_id: order.store_id })
                            ]
                        );
                    }
                }
            }

            // If status is 'delivered', update delivery record and release payments
            if (status === 'delivered') {
                await connection.execute(
                    `UPDATE deliveries 
                     SET status = 'delivered', 
                         delivered_at = CURRENT_TIMESTAMP
                     WHERE order_id = ?`,
                    [orderId || null]
                );

                // Calculate and update rider earnings
                const [feeRows] = await connection.execute(
                    `SELECT delivery_fee FROM platform_fees WHERE order_id = ?`,
                    [orderId || null]
                );

                if (feeRows[0]) {
                    const riderEarnings = feeRows[0].delivery_fee * 0.70; // Rider gets 70% of delivery fee

                    await connection.execute(
                        `UPDATE deliveries 
                         SET rider_earnings = ?, 
                             platform_commission = ?
                         WHERE order_id = ?`,
                        [riderEarnings, (feeRows[0].delivery_fee || 0) * 0.30, orderId || null]
                    );

                    // Update rider's earnings
                    await connection.execute(
                        `UPDATE riders 
                         SET earnings_today = earnings_today + ?, 
                             total_deliveries = total_deliveries + 1
                         WHERE id = ?`,
                        [riderEarnings, order.rider_id || null]
                    );
                }
            }

            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Get orders by customer
    static async findByCustomerId(customerId, limit = 20, offset = 0) {
        const [rows] = await db.execute(
            `SELECT o.*, s.name as store_name, s.logo_url as store_logo
             FROM orders o
             JOIN stores s ON o.store_id = s.id
             WHERE o.customer_id = ?
             ORDER BY o.created_at DESC
             LIMIT ${parseInt(limit) || 20} OFFSET ${parseInt(offset) || 0}`,
            [customerId || null]
        );
        return rows;
    }

    // Get orders by store
    static async findByStoreId(storeId, status = null, limit = 50, offset = 0) {
        let query = `
            SELECT o.*, c.full_name as customer_name, 
                   c.phone as customer_phone, r.full_name as rider_name
            FROM orders o
            LEFT JOIN users c ON o.customer_id = c.id
            LEFT JOIN users r ON o.rider_id = r.id
            WHERE o.store_id = ?
        `;

        const params = [storeId || null];

        if (status) {
            query += ' AND o.order_status = ?';
            params.push(status);
        }

        query += ` ORDER BY o.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

        const [rows] = await db.execute(query, params);
        return rows;
    }

    // Get orders by rider
    static async findByRiderId(riderId, status = null, limit = 50, offset = 0) {
        let query = `
            SELECT o.*, s.name as store_name, c.full_name as customer_name,
                   c.phone as customer_phone
            FROM orders o
            JOIN stores s ON o.store_id = s.id
            JOIN users c ON o.customer_id = c.id
            WHERE o.rider_id = ?
        `;

        const params = [riderId];

        if (status) {
            query += ' AND o.order_status = ?';
            params.push(status);
        }

        query += ` ORDER BY o.created_at DESC LIMIT ${parseInt(limit) || 50} OFFSET ${parseInt(offset) || 0}`;

        const [rows] = await db.execute(query, params);
        return rows;
    }

    // Get order statistics
    static async getStats(userId, userType) {
        let query = '';
        const params = [userId];

        if (userType === 'customer') {
            query = `
                SELECT 
                    COUNT(*) as total_orders,
                    SUM(total_amount) as total_spent,
                    AVG(total_amount) as avg_order_value,
                    COUNT(CASE WHEN order_status = 'delivered' THEN 1 END) as delivered_orders,
                    COUNT(CASE WHEN order_status = 'cancelled' THEN 1 END) as cancelled_orders
                FROM orders
                WHERE customer_id = ?
            `;
        } else if (userType === 'seller') {
            query = `
                SELECT 
                    COUNT(*) as total_orders,
                    SUM(subtotal) as total_sales,
                    AVG(subtotal) as avg_order_value,
                    SUM(platform_fee) as total_commission,
                    COUNT(CASE WHEN order_status = 'delivered' THEN 1 END) as delivered_orders
                FROM orders o
                JOIN stores s ON o.store_id = s.id
                WHERE s.seller_id = ?
            `;
        } else if (userType === 'rider') {
            query = `
                SELECT 
                    COUNT(*) as total_deliveries,
                    SUM(d.rider_earnings) as total_earnings,
                    AVG(d.rider_earnings) as avg_earning_per_delivery,
                    COUNT(CASE WHEN d.status = 'delivered' THEN 1 END) as completed_deliveries
                FROM deliveries d
                WHERE d.rider_id = ?
            `;
        }

        const [rows] = await db.execute(query, params);
        return rows[0] || {};
    }

    // Search orders (admin)
    static async search(filters) {
        let query = `
            SELECT o.*, s.name as store_name, c.full_name as customer_name,
                   r.full_name as rider_name
            FROM orders o
            LEFT JOIN stores s ON o.store_id = s.id
            LEFT JOIN users c ON o.customer_id = c.id
            LEFT JOIN users r ON o.rider_id = r.id
            WHERE 1=1
        `;

        const params = [];

        if (filters.order_number) {
            query += ' AND o.order_number LIKE ?';
            params.push(`%${filters.order_number}%`);
        }

        if (filters.customer_name) {
            query += ' AND c.full_name LIKE ?';
            params.push(`%${filters.customer_name}%`);
        }

        if (filters.store_name) {
            query += ' AND s.name LIKE ?';
            params.push(`%${filters.store_name}%`);
        }

        if (filters.status) {
            query += ' AND o.order_status = ?';
            params.push(filters.status);
        }

        if (filters.start_date) {
            query += ' AND o.created_at >= ?';
            params.push(filters.start_date);
        }

        if (filters.end_date) {
            query += ' AND o.created_at <= ?';
            params.push(filters.end_date);
        }

        query += ' ORDER BY o.created_at DESC LIMIT 100';

        const [rows] = await db.execute(query, params);
        return rows;
    }

    static async totalRevenue() {
        const [rows] = await db.execute('SELECT SUM(total_amount) as total FROM orders WHERE order_status = "delivered"');
        return rows[0].total || 0;
    }

    static async count() {
        const [rows] = await db.execute('SELECT COUNT(*) as count FROM orders');
        return rows[0].count;
    }

    static async countByStoreId(storeId) {
        const [rows] = await db.execute('SELECT COUNT(*) as count FROM orders WHERE store_id = ?', [storeId || null]);
        return rows[0].count;
    }

    static async revenueByStoreId(storeId) {
        const [rows] = await db.execute(
            'SELECT SUM(total_amount) as total FROM orders WHERE store_id = ? AND order_status = "delivered"',
            [storeId || null]
        );
        return rows[0].total || 0;
    }

    static async findAvailableJobs() {
        const [rows] = await db.execute(
            `SELECT o.*, s.name as store_name, s.address as store_address, s.logo_url as store_logo
             FROM orders o
             JOIN stores s ON o.store_id = s.id
             WHERE o.order_status = 'ready_for_pickup' AND o.rider_id IS NULL`
        );
        return rows;
    }

    static async countByRiderId(riderId) {
        const [rows] = await db.execute('SELECT COUNT(*) as count FROM orders WHERE rider_id = ?', [riderId || null]);
        return rows[0].count;
    }

    static async getDailySales(storeId, days = 7) {
        const [rows] = await db.execute(
            `SELECT DATE(created_at) as date, SUM(total_amount) as total
             FROM orders
             WHERE store_id = ? AND order_status = 'delivered'
             AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             GROUP BY DATE(created_at)
             ORDER BY date ASC`,
            [storeId || null, parseInt(days) || 7]
        );
        return rows;
    }

    static async getCategoryDistribution(storeId) {
        const [rows] = await db.execute(
            `SELECT p.category, SUM(oi.total_price) as value
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             JOIN orders o ON oi.order_id = o.id
             WHERE o.store_id = ? AND o.order_status = 'delivered'
             GROUP BY p.category`,
            [storeId || null]
        );
        return rows;
    }
}

module.exports = Order;
