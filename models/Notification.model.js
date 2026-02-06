const db = require('../config/database');

class Notification {
    static async create(data) {
        const [result] = await db.execute(
            `INSERT INTO notifications (user_id, type, title, message, data)
             VALUES (?, ?, ?, ?, ?)`,
            [data.user_id || null, data.type || 'info', data.title || '', data.message || '', JSON.stringify(data.data || {})]
        );
        return result.insertId;
    }
}

module.exports = Notification;
