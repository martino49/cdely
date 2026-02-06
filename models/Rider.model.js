const db = require('../config/database');

class Rider {
    static async findById(id) {
        const [rows] = await db.execute(
            `SELECT r.*, u.full_name, u.email, u.phone, u.profile_picture
             FROM riders r
             JOIN users u ON r.id = u.id
             WHERE r.id = ?`,
            [id]
        );
        return rows[0];
    }

    static async updateStatus(id, status) {
        const [result] = await db.execute(
            'UPDATE riders SET status = ? WHERE id = ?',
            [status || 'offline', id || null]
        );
        return result.affectedRows > 0;
    }

    static async updateLocation(id, lat, lng) {
        const [result] = await db.execute(
            'UPDATE riders SET current_lat = ?, current_lng = ?, last_location_update = CURRENT_TIMESTAMP WHERE id = ?',
            [lat || null, lng || null, id || null]
        );
        return result.affectedRows > 0;
    }

    static async getStats(id) {
        const [rows] = await db.execute(
            'SELECT rating, total_deliveries, total_earnings, on_time_rate FROM riders WHERE id = ?',
            [id || null]
        );
        return rows[0];
    }
}

module.exports = Rider;
