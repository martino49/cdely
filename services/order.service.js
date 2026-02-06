const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const Store = require('../models/Store.model');
const User = require('../models/User.model');
const Notification = require('../models/Notification.model');
const { calculateDistance, calculateDeliveryFee, calculateEstimatedTime } = require('../utils/generators');

class OrderService {
    // Create new order with all business logic
    static async createOrder(customerId, orderData) {
        // Validate store is open
        const store = await Store.findById(orderData.store_id);
        if (!store || !store.is_open) {
            throw new Error('Store is closed or does not exist');
        }

        // Validate all products are available
        let subtotal = 0;
        const orderItems = [];

        for (const item of orderData.items) {
            const product = await Product.findById(item.product_id);

            if (!product || !product.is_available) {
                throw new Error(`Product ${item.product_id} is not available`);
            }

            if (product.stock_quantity < item.quantity) {
                throw new Error(`Insufficient stock for ${product.name}`);
            }

            if (product.store_id !== parseInt(orderData.store_id)) {
                throw new Error(`Product ${product.name} does not belong to this store`);
            }

            const price = product.discounted_price || product.price;
            const itemTotal = price * item.quantity;

            orderItems.push({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: price,
                total_price: itemTotal,
                special_instructions: item.special_instructions
            });

            subtotal += itemTotal;
        }

        // Check minimum order amount
        if (store.minimum_order && subtotal < store.minimum_order) {
            throw new Error(`Minimum order amount is ${store.minimum_order}`);
        }

        // Calculate delivery fee
        let deliveryFee = 0;
        if (orderData.delivery_lat && orderData.delivery_lng) {
            const distance = calculateDistance(
                store.latitude,
                store.longitude,
                orderData.delivery_lat,
                orderData.delivery_lng
            );
            deliveryFee = calculateDeliveryFee(distance);
        }

        // Calculate platform fee (10% commission)
        const platformFee = subtotal * 0.10;

        // Calculate total
        const totalAmount = subtotal + deliveryFee + platformFee + 0.50; // + service fee

        // Create order data
        const orderPayload = {
            customer_id: customerId,
            store_id: orderData.store_id,
            subtotal,
            delivery_fee: deliveryFee,
            platform_fee: platformFee,
            total_amount: totalAmount,
            payment_method: orderData.payment_method,
            delivery_address: orderData.delivery_address,
            delivery_lat: orderData.delivery_lat,
            delivery_lng: orderData.delivery_lng,
            items: orderItems
        };

        // Create order in database
        const orderId = await Order.create(orderPayload);

        // Get the created order
        const order = await Order.findById(orderId);

        // Send notifications
        await this.sendOrderNotifications(order);

        // Return order with details
        return {
            success: true,
            order: {
                id: orderId,
                order_number: order.order_number,
                tracking_code: order.tracking_code,
                total: totalAmount,
                estimated_delivery: calculateEstimatedTime(
                    calculateDistance(
                        store.latitude,
                        store.longitude,
                        orderData.delivery_lat,
                        orderData.delivery_lng
                    ),
                    store.preparation_time
                )
            }
        };
    }

    // Send notifications for new order
    static async sendOrderNotifications(order) {
        // Notify customer
        await Notification.create({
            user_id: order.customer_id,
            type: 'order_confirmation',
            title: 'Order Confirmed',
            message: `Your order #${order.order_number} has been placed successfully.`,
            data: { order_id: order.id }
        });

        // Notify seller
        const store = await Store.findById(order.store_id);
        if (store) {
            await Notification.create({
                user_id: store.seller_id,
                type: 'order_confirmation',
                title: 'New Order Received',
                message: `You have a new order #${order.order_number}.`,
                data: { order_id: order.id, store_id: store.id }
            });
        }

        // Send email/SMS notifications would go here
    }

    // Process order status change
    static async processStatusChange(orderId, newStatus, userId, userType, notes = null) {
        const order = await Order.findById(orderId);

        if (!order) {
            throw new Error('Order not found');
        }

        // Verify permissions
        if (userType === 'seller') {
            const store = await Store.findById(order.store_id);
            if (store.seller_id !== userId) {
                throw new Error('Not authorized to update this order');
            }
        } else if (userType === 'rider') {
            if (order.rider_id !== userId) {
                throw new Error('Not authorized to update this order');
            }
        }

        // Update status
        const updated = await Order.updateStatus(orderId, newStatus, notes);

        if (updated) {
            // Send notification to customer
            await Notification.create({
                user_id: order.customer_id,
                type: 'order_status_update',
                title: 'Order Status Updated',
                message: `Your order #${order.order_number} is now ${newStatus.replace('_', ' ')}`,
                data: { order_id: orderId, status: newStatus }
            });

            // Additional actions based on status
            if (newStatus === 'ready_for_pickup') {
                await this.assignRider(orderId);
            } else if (newStatus === 'delivered') {
                await this.completeOrder(orderId);
            }
        }

        return updated;
    }

    // Assign rider to order
    static async assignRider(orderId) {
        const order = await Order.findById(orderId);
        const store = await Store.findById(order.store_id);

        // Find nearest available rider
        const [riders] = await db.execute(`
            SELECT r.id, r.current_lat, r.current_lng
            FROM riders r
            WHERE r.status = 'available'
            AND r.is_approved = TRUE
            ORDER BY 
                SQRT(POW(69.1 * (r.current_lat - ?), 2) + 
                     POW(69.1 * (? - r.current_lng) * COS(r.current_lat / 57.3), 2))
            LIMIT 1
        `, [store.latitude || 0, store.longitude || 0]);

        if (riders.length > 0) {
            const rider = riders[0];

            // Update order with rider
            await db.execute(
                'UPDATE orders SET rider_id = ? WHERE id = ?',
                [rider.id || null, orderId || null]
            );

            // Update rider status
            await db.execute(
                'UPDATE riders SET status = "busy" WHERE id = ?',
                [rider.id || null]
            );

            // Create delivery record
            await db.execute(
                `INSERT INTO deliveries (order_id, rider_id, status)
                 VALUES (?, ?, 'assigned')`,
                [orderId || null, rider.id || null]
            );

            // Notify rider
            await Notification.create({
                user_id: rider.id,
                type: 'rider_assigned',
                title: 'New Delivery Assignment',
                message: `You have been assigned to deliver order #${order.order_number}`,
                data: { order_id: orderId, store_id: store.id }
            });

            // Notify customer
            const riderUser = await User.findById(rider.id);
            await Notification.create({
                user_id: order.customer_id,
                type: 'rider_assigned',
                title: 'Rider Assigned',
                message: `${riderUser.name} has been assigned to deliver your order`,
                data: { order_id: orderId, rider_id: rider.id }
            });

            return rider;
        }

        return null;
    }

    // Complete order and process payments
    static async completeOrder(orderId) {
        const order = await Order.findById(orderId);

        if (!order || order.order_status !== 'delivered') {
            throw new Error('Order not ready for completion');
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Update payment status to completed if COD
            if (order.payment_method === 'cash') {
                await connection.execute(
                    'UPDATE orders SET payment_status = "paid" WHERE id = ?',
                    [orderId || null]
                );
            }

            // Calculate and record fees
            const delivery = await Delivery.findByOrderId(orderId);
            if (delivery) {
                // Rider gets 70% of delivery fee
                const riderEarnings = order.delivery_fee * 0.70;

                await connection.execute(
                    `UPDATE deliveries 
                     SET rider_earnings = ?, 
                         platform_commission = ?
                     WHERE order_id = ?`,
                    [riderEarnings, (order.delivery_fee || 0) * 0.30, orderId || null]
                );

                // Update rider's earnings
                await connection.execute(
                    `UPDATE riders 
                     SET earnings_today = earnings_today + ?, 
                         total_deliveries = total_deliveries + 1,
                         status = 'available'
                     WHERE id = ?`,
                    [riderEarnings, order.rider_id || null]
                );
            }

            // Create transaction record for seller
            const sellerEarnings = order.subtotal - (order.subtotal * 0.10); // Minus 10% commission
            await connection.execute(
                `INSERT INTO transactions 
                 (user_id, order_id, type, amount, description, status)
                 VALUES (?, ?, 'credit', ?, 'Order completion', 'completed')`,
                [order.store_id || null, orderId || null, sellerEarnings]
            );

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Cancel order with refund logic
    static async cancelOrder(orderId, userId, reason) {
        const order = await Order.findById(orderId);

        if (!order) {
            throw new Error('Order not found');
        }

        // Check if order can be cancelled
        const cancellableStatuses = ['pending', 'confirmed', 'preparing'];
        if (!cancellableStatuses.includes(order.order_status)) {
            throw new Error('Order cannot be cancelled at this stage');
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Update order status
            await connection.execute(
                'UPDATE orders SET order_status = "cancelled" WHERE id = ?',
                [orderId || null]
            );

            // Restore product stock
            const items = await Order.getOrderItems(orderId);
            for (const item of items) {
                await connection.execute(
                    'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
                    [item.quantity || 0, item.product_id || null]
                );
            }

            // Process refund if payment was made
            if (order.payment_status === 'paid') {
                await connection.execute(
                    `INSERT INTO transactions 
                     (user_id, order_id, type, amount, description, status)
                     VALUES (?, ?, 'credit', ?, 'Order cancellation refund', 'completed')`,
                    [order.customer_id || null, orderId || null, order.total_amount || 0]
                );
            }

            // Notify all parties
            await Notification.create({
                user_id: order.customer_id,
                type: 'order_status_update',
                title: 'Order Cancelled',
                message: `Your order #${order.order_number} has been cancelled.`,
                data: { order_id: orderId, reason }
            });

            const store = await Store.findById(order.store_id);
            if (store) {
                await Notification.create({
                    user_id: store.seller_id,
                    type: 'order_status_update',
                    title: 'Order Cancelled',
                    message: `Order #${order.order_number} has been cancelled.`,
                    data: { order_id: orderId, reason }
                });
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Get order analytics
    static async getAnalytics(storeId = null, startDate = null, endDate = null) {
        let query = `
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as order_count,
                SUM(total_amount) as total_revenue,
                AVG(total_amount) as avg_order_value,
                COUNT(CASE WHEN order_status = 'delivered' THEN 1 END) as delivered_count,
                COUNT(CASE WHEN order_status = 'cancelled' THEN 1 END) as cancelled_count
            FROM orders
            WHERE 1=1
        `;

        const params = [];

        if (storeId) {
            query += ' AND store_id = ?';
            params.push(storeId);
        }

        if (startDate) {
            query += ' AND created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND created_at <= ?';
            params.push(endDate);
        }

        query += ' GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30';

        const [rows] = await db.execute(query, params);

        // Calculate totals
        const totals = {
            total_orders: 0,
            total_revenue: 0,
            delivered_orders: 0,
            cancelled_orders: 0
        };

        rows.forEach(row => {
            totals.total_orders += row.order_count;
            totals.total_revenue += row.total_revenue;
            totals.delivered_orders += row.delivered_count;
            totals.cancelled_orders += row.cancelled_count;
        });

        totals.avg_order_value = totals.total_orders > 0
            ? totals.total_revenue / totals.total_orders
            : 0;

        return {
            daily_stats: rows,
            totals,
            conversion_rate: totals.total_orders > 0
                ? ((totals.delivered_orders / totals.total_orders) * 100).toFixed(2)
                : 0
        };
    }
}

module.exports = OrderService;
