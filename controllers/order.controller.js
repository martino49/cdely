const Order = require('../models/Order.model');
const OrderService = require('../services/order.service');
const Cart = require('../models/Cart.model'); // Need to create optional Cart model or mock it
// Mock Cart model for now if it doesn't exist or use raw DB queries in controller
// The user prompt didn't strictly provide Cart.model.js but used it.
// I will assume Cart model functionalities or placeholder
const db = require('../config/database');

const { formatCurrency } = require('../utils/generators');

// Helper for Cart since it wasn't fully defined but used
const CartHelper = {
    getByCustomerAndStore: async (customerId, storeId) => {
        const [rows] = await db.execute(
            'SELECT * FROM carts WHERE customer_id = ? AND store_id = ?',
            [customerId || null, storeId || null]
        );
        return rows;
    }
};


exports.createOrder = async (req, res) => {
    try {
        const { store_id, delivery_address, delivery_lat, delivery_lng, payment_method, notes } = req.body;

        // Get cart items for this store
        const cartItems = await CartHelper.getByCustomerAndStore(req.user.id, store_id);

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty for this store'
            });
        }

        // Prepare order data
        const orderData = {
            store_id,
            delivery_address,
            delivery_lat: parseFloat(delivery_lat),
            delivery_lng: parseFloat(delivery_lng),
            payment_method,
            notes,
            items: cartItems.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                special_instructions: item.special_instructions
            }))
        };

        // Create order using service
        const result = await OrderService.createOrder(req.user.id, orderData);

        res.json({
            success: true,
            message: 'Order created successfully',
            data: result
        });
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.getOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const offset = (page - 1) * limit;

        let orders;
        let total;

        if (req.user.user_type === 'customer') {
            orders = await Order.findByCustomerId(req.user.id, parseInt(limit), offset);
            const [countRows] = await db.execute(
                'SELECT COUNT(*) as total FROM orders WHERE customer_id = ?',
                [req.user ? req.user.id : null]
            );
            total = countRows[0].total;
        } else if (req.user.user_type === 'seller') {
            // Get seller's store
            const [storeRows] = await db.execute(
                'SELECT id FROM stores WHERE seller_id = ?',
                [req.user.id]
            );

            if (storeRows.length > 0) {
                const storeId = storeRows[0].id;
                orders = await Order.findByStoreId(storeId, status, parseInt(limit), offset);
                const [countRows] = await db.execute(
                    'SELECT COUNT(*) as total FROM orders WHERE store_id = ?',
                    [storeId || null]
                );
                total = countRows[0].total;
            } else {
                orders = [];
                total = 0;
            }
        } else if (req.user.user_type === 'rider') {
            orders = await Order.findByRiderId(req.user.id, status, parseInt(limit), offset);
            const [countRows] = await db.execute(
                'SELECT COUNT(*) as total FROM orders WHERE rider_id = ?',
                [req.user ? req.user.id : null]
            );
            total = countRows[0].total;
        }

        // Format orders for display
        const formattedOrders = orders.map(order => ({
            id: order.id,
            order_number: order.order_number,
            store_name: order.store_name,
            customer_name: order.customer_name,
            total: formatCurrency(order.total_amount),
            status: order.order_status,
            created_at: order.created_at,
            tracking_code: order.tracking_code
        }));

        res.render('customer/orders-list', {
            title: 'My Orders',
            orders: formattedOrders,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            statusFilter: status
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId, req.user.id, req.user.user_type);

        if (!order) {
            return res.status(404).render('errors/404');
        }

        const items = await Order.getOrderItems(orderId);

        // Format order for display
        const formattedOrder = {
            ...order,
            subtotal: formatCurrency(order.subtotal),
            delivery_fee: formatCurrency(order.delivery_fee),
            platform_fee: formatCurrency(order.platform_fee),
            total_amount: formatCurrency(order.total_amount),
            items: items.map(item => ({
                ...item,
                unit_price: formatCurrency(item.unit_price),
                total_price: formatCurrency(item.total_price)
            }))
        };

        res.render('customer/order-detail', {
            title: `Order #${order.order_number}`,
            order: formattedOrder,
            userType: req.user.user_type
        });
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.trackOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId, req.user.id, req.user.user_type);

        if (!order) {
            return res.status(404).render('errors/404');
        }

        // Get delivery tracking data
        const delivery = await Delivery.findByOrderId(orderId);
        let trackingPoints = [];

        if (delivery) {
            trackingPoints = await Delivery.getTrackingPoints(delivery.id);
        }

        res.render('customer/tracking', {
            title: `Track Order #${order.order_number}`,
            order,
            delivery,
            trackingPoints: JSON.stringify(trackingPoints),
            mapApiKey: process.env.GOOGLE_MAPS_API_KEY
        });
    } catch (error) {
        console.error('Track order error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const updated = await OrderService.processStatusChange(
            id,
            status,
            req.user.id,
            req.user.user_type,
            notes
        );

        if (updated) {
            res.json({
                success: true,
                message: 'Order status updated successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to update order status'
            });
        }
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const cancelled = await OrderService.cancelOrder(id, req.user.id, reason);

        if (cancelled) {
            res.json({
                success: true,
                message: 'Order cancelled successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to cancel order'
            });
        }
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.getOrderAnalytics = async (req, res) => {
    try {
        let storeId = null;

        if (req.user.user_type === 'seller') {
            const [storeRows] = await db.execute(
                'SELECT id FROM stores WHERE seller_id = ?',
                [req.user ? req.user.id : null]
            );
            if (storeRows.length > 0) {
                storeId = storeRows[0].id;
            }
        }

        const { start_date, end_date } = req.query;
        const analytics = await OrderService.getAnalytics(storeId, start_date, end_date);

        res.render('seller/analytics', {
            title: 'Order Analytics',
            analytics,
            startDate: start_date,
            endDate: end_date
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

// API endpoint for order tracking (for AJAX updates)
exports.apiTrackOrder = async (req, res) => {
    try {
        const { tracking_code } = req.query;

        if (!tracking_code) {
            return res.json({ success: false, message: 'Tracking code required' });
        }

        const [orderRows] = await db.execute(
            `SELECT o.*, s.name as store_name, 
                    c.name as customer_name, r.name as rider_name,
                    d.status as delivery_status
             FROM orders o
             LEFT JOIN stores s ON o.store_id = s.id
             LEFT JOIN users c ON o.customer_id = c.id
             LEFT JOIN users r ON o.rider_id = r.id
             LEFT JOIN deliveries d ON o.id = d.order_id
             WHERE o.tracking_code = ?`,
            [tracking_code || '']
        );

        if (orderRows.length === 0) {
            return res.json({
                success: false,
                message: 'Order not found'
            });
        }

        const order = orderRows[0];

        // Get tracking points if delivery exists
        let trackingPoints = [];
        if (order.delivery_status) {
            const [deliveryRows] = await db.execute(
                'SELECT id FROM deliveries WHERE order_id = ?',
                [order.id || null]
            );

            if (deliveryRows.length > 0) {
                const deliveryId = deliveryRows[0].id;
                trackingPoints = await Delivery.getTrackingPoints(deliveryId);
            }
        }

        res.json({
            success: true,
            order: {
                id: order.id,
                order_number: order.order_number,
                status: order.order_status,
                delivery_status: order.delivery_status,
                store_name: order.store_name,
                customer_name: order.customer_name,
                rider_name: order.rider_name,
                estimated_delivery: order.estimated_delivery_time,
                tracking_code: order.tracking_code
            },
            tracking_points: trackingPoints
        });
    } catch (error) {
        console.error('API track order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
