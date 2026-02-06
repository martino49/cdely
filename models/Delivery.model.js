const db = require('../config/database');

class Delivery {
    // Start tracking session
    static async startTracking(orderId, riderId) {
        const [result] = await db.execute(
            `INSERT INTO deliveries (order_id, rider_id, status)
             VALUES (?, ?, 'assigned')
             ON DUPLICATE KEY UPDATE status = 'assigned'`,
            [orderId || null, riderId || null]
        );
        return result.insertId;
    }

    // Update delivery status
    static async updateStatus(deliveryId, status) {
        const [result] = await db.execute(
            `UPDATE deliveries 
             SET status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [status || null, deliveryId || null]
        );
        return result.affectedRows > 0;
    }

    // Add tracking point
    static async addTrackingPoint(deliveryId, lat, lng, accuracy = null, battery = null) {
        const [result] = await db.execute(
            `INSERT INTO tracking_points 
             (delivery_id, latitude, longitude, accuracy, battery_level)
             VALUES (?, ?, ?, ?, ?)`,
            [deliveryId || null, lat || null, lng || null, accuracy || null, battery || null]
        );
        return result.insertId;
    }

    // Get delivery tracking points
    static async getTrackingPoints(deliveryId, limit = 50) {
        const [rows] = await db.execute(
            `SELECT latitude, longitude, accuracy, battery_level, recorded_at
             FROM tracking_points
             WHERE delivery_id = ?
             ORDER BY recorded_at DESC
             LIMIT ${parseInt(limit) || 50}`,
            [deliveryId]
        );
        return rows.reverse(); // Return in chronological order
    }

    // Get delivery by order ID
    static async findByOrderId(orderId) {
        const [rows] = await db.execute(
            `SELECT d.*, u.full_name as rider_name, u.phone as rider_phone,
                    r.vehicle_type, r.rating as rider_rating
             FROM deliveries d
             JOIN riders r ON d.rider_id = r.id
             JOIN users u ON r.id = u.id
             WHERE d.order_id = ?`,
            [orderId || null]
        );
        return rows[0];
    }

    // Get active deliveries for rider
    static async getActiveDeliveries(riderId) {
        const [rows] = await db.execute(
            `SELECT d.*, o.order_number, o.delivery_address,
                    s.name as store_name, s.address as store_address,
                    c.full_name as customer_name, c.phone as customer_phone
             FROM deliveries d
             JOIN orders o ON d.order_id = o.id
             JOIN stores s ON o.store_id = s.id
             JOIN users c ON o.customer_id = c.id
             WHERE d.rider_id = ? 
             AND d.status IN ('assigned', 'arrived_at_store', 'picked_up', 'in_transit')
             ORDER BY d.estimated_delivery_time ASC`,
            [riderId || null]
        );
        return rows;
    }

    // Mark delivery as delivered
    static async markAsDelivered(deliveryId, proofPhoto = null, signature = null) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Update delivery
            const [result] = await connection.execute(
                `UPDATE deliveries 
                 SET status = 'delivered',
                     delivery_proof_photo = ?,
                     delivery_signature = ?,
                     delivered_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [proofPhoto || null, signature || null, deliveryId || null]
            );

            // Update order status
            await connection.execute(
                `UPDATE orders 
                 SET order_status = 'delivered',
                     actual_delivery_time = CURRENT_TIMESTAMP
                 WHERE id = (SELECT order_id FROM deliveries WHERE id = ?)`,
                [deliveryId || null]
            );

            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Get delivery statistics
    static async getStats(riderId, startDate = null, endDate = null) {
        let query = `
            SELECT 
                COUNT(*) as total_deliveries,
                SUM(rider_earnings) as total_earnings,
                AVG(rider_earnings) as avg_earnings,
                COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed_deliveries,
                COUNT(CASE WHEN status = 'in_transit' THEN 1 END) as in_progress,
                MIN(delivered_at - created_at) as fastest_delivery,
                AVG(delivered_at - created_at) as avg_delivery_time
            FROM deliveries
            WHERE rider_id = ?
        `;

        const params = [riderId || null];

        if (startDate) {
            query += ' AND created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND created_at <= ?';
            params.push(endDate);
        }

        const [rows] = await db.execute(query, params);
        return rows[0] || {};
    }

    // Get delivery timeline
    static async getTimeline(deliveryId) {
        const [rows] = await db.execute(
            `SELECT 
                'delivery_created' as event,
                created_at as timestamp,
                'Delivery created' as description
             FROM deliveries WHERE id = ?
             
             UNION ALL
             
             SELECT 
                'status_change' as event,
                updated_at as timestamp,
                CONCAT('Status changed to ', status) as description
             FROM deliveries WHERE id = ?
             
             UNION ALL
             
             SELECT 
                'tracking_point' as event,
                recorded_at as timestamp,
                CONCAT('Location update (', latitude, ', ', longitude, ')') as description
             FROM tracking_points
             WHERE delivery_id = ?
             
             ORDER BY timestamp`,
            [deliveryId || null, deliveryId || null, deliveryId || null]
        );
        return rows;
    }
}

module.exports = Delivery;
