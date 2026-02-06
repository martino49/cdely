const db = require('../config/database');

class User {
    static async create(userData) {
        const [result] = await db.execute(
            'INSERT INTO users (email, password_hash, full_name, phone, user_type, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [userData.email || '', userData.password_hash || '', userData.full_name || '', userData.phone || '', userData.user_type || 'customer']
        );
        return result.insertId;
    }

    static async findByEmail(email) {
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE email = ?',
            [email || '']
        );
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE id = ?',
            [id || null]
        );
        return rows[0];
    }

    static async updateProfile(id, updateData) {
        const fields = [];
        const values = [];

        if (updateData.full_name) {
            fields.push('full_name = ?');
            values.push(updateData.full_name);
        }
        if (updateData.phone) {
            fields.push('phone = ?');
            values.push(updateData.phone);
        }
        if (updateData.profile_picture) {
            fields.push('profile_picture = ?');
            values.push(updateData.profile_picture);
        }

        values.push(id || null);

        const [result] = await db.execute(
            `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    static async findAll(limit = 100, offset = 0) {
        const [rows] = await db.execute(
            `SELECT id, full_name, email, phone, user_type, created_at FROM users ORDER BY created_at DESC LIMIT ${parseInt(limit) || 100} OFFSET ${parseInt(offset) || 0}`
        );
        return rows;
    }

    static async count() {
        const [rows] = await db.execute('SELECT COUNT(*) as count FROM users');
        return rows[0].count;
    }

    static async delete(id) {
        const [result] = await db.execute('DELETE FROM users WHERE id = ?', [id || null]);
        return result.affectedRows > 0;
    }
}

module.exports = User;
