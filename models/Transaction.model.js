const db = require('../config/database');

class Transaction {
    static async create(data, connection = null) {
        const conn = connection || db;
        const [result] = await conn.execute(
            `INSERT INTO transactions (
                transaction_ref, user_id, type, amount, 
                payment_method, description, status, category
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.transaction_ref,
                data.user_id,
                data.type,
                data.amount,
                data.payment_method || 'system',
                data.description,
                data.status || 'completed',
                data.category || 'other'
            ]
        );
        return result.insertId;
    }

    static async findByUserId(userId, limit = 20) {
        const [rows] = await db.execute(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
            [userId, String(limit)]
        );
        return rows;
    }
}

module.exports = Transaction;
