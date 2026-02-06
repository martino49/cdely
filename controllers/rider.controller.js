const Order = require('../models/Order.model');
const Delivery = require('../models/Delivery.model');

exports.getDashboard = async (req, res) => {
    try {
        const riderId = req.user ? req.user.id : null;
        if (!riderId) return res.status(401).render('errors/401');
        const stats = await Delivery.getStats(riderId);
        const activeDeliveries = await Delivery.getActiveDeliveries(riderId);

        res.render('rider/dashboard', {
            title: 'Rider Dashboard',
            stats,
            activeDeliveries,
            user: req.user
        });
    } catch (error) {
        console.error('Rider Dashboard error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.getAvailableOrders = async (req, res) => {
    try {
        const availableOrders = await Order.findAvailableJobs();
        res.render('rider/available-orders', {
            title: 'Available Jobs',
            orders: availableOrders,
            user: req.user
        });
    } catch (error) {
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.acceptOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        // Assign rider to order and create delivery record
        await Delivery.startTracking(orderId, req.user.id);

        // Update order status to 'rider_assigned'
        await Order.updateStatus(orderId, 'rider_assigned');

        res.json({ success: true, message: 'Order accepted! Go to active delivery.' });
    } catch (error) {
        console.error('acceptOrder error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getActiveDelivery = async (req, res) => {
    try {
        const activeDeliveries = await Delivery.getActiveDeliveries(req.user.id);
        if (!activeDeliveries || activeDeliveries.length === 0) {
            return res.render('rider/active-delivery', {
                title: 'Active Delivery',
                delivery: null,
                user: req.user
            });
        }

        // For simplicity, we handle one active delivery at a time
        const delivery = activeDeliveries[0];
        const items = await Order.getOrderItems(delivery.order_id);

        res.render('rider/active-delivery', {
            title: 'Active Delivery',
            delivery,
            items,
            user: req.user,
            mapboxToken: process.env.MAPBOX_ACCESS_TOKEN
        });
    } catch (error) {
        console.error('getActiveDelivery error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.updateDeliveryStatus = async (req, res) => {
    try {
        const { deliveryId, status, lat, lng } = req.body;

        // Update delivery master record
        await Delivery.updateStatus(deliveryId, status);

        // Add tracking point for historical data
        if (lat && lng) {
            await Delivery.addTrackingPoint(deliveryId, lat, lng);
        }

        // Map delivery status to order status if necessary
        if (orderStatus) {
            const [deliveryRows] = await db.execute('SELECT order_id FROM deliveries WHERE id = ?', [deliveryId || null]);
            if (deliveryRows && deliveryRows[0]) {
                await Order.updateStatus(deliveryRows[0].order_id, orderStatus);
            }
        }

        if (status === 'delivered') {
            await Delivery.markAsDelivered(deliveryId || null);
        }

        res.json({ success: true, message: `Status updated to ${status}` });
    } catch (error) {
        console.error('updateDeliveryStatus error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getEarnings = async (req, res) => {
    try {
        const stats = await Delivery.getStats(req.user.id);
        res.render('rider/earnings', {
            title: 'My Earnings',
            stats,
            user: req.user
        });
    } catch (error) {
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const [riderRows] = await db.execute('SELECT * FROM riders WHERE id = ?', [req.user.id]);
        res.render('rider/profile-rider', {
            title: 'Rider Profile',
            rider: riderRows[0] || {},
            user: req.user
        });
    } catch (error) {
        res.status(500).render('errors/500', { error: error.message });
    }
};
const db = require('../config/database');
