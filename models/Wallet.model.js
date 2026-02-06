const db = require('../config/database');

class Wallet {
    static async findByUserId(userId) {
        const [rows] = await db.execute('SELECT * FROM wallets WHERE user_id = ?', [userId]);
        return rows[0];
    }

    static async create(userId) {
        const [result] = await db.execute(
            'INSERT INTO wallets (user_id, balance, currency) VALUES (?, 0.00, "KES")',
            [userId]
        );
        return result.insertId;
    }

    static async updateBalance(userId, amount, type, connection = null) {
        const conn = connection || db;
        const operator = type === 'credit' ? '+' : '-';

        await conn.execute(
            `UPDATE wallets SET balance = balance ${operator} ? WHERE user_id = ?`,
            [Math.abs(amount), userId]
        );
        return true;
    }

    static async getBalance(userId) {
        const wallet = await this.findByUserId(userId);
        return wallet ? parseFloat(wallet.balance) : 0.00;
    }
}

module.exports = Wallet;
