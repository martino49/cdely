const db = require('../config/database');

class Address {
    static async create(userId, addressData) {
        const { label, contact_name, contact_phone, address_line1, address_line2, landmark, city, state, postal_code, latitude, longitude, is_default } = addressData;

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            if (is_default) {
                await connection.execute('UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?', [userId]);
            }

            const [result] = await connection.execute(
                `INSERT INTO user_addresses (
                    user_id, label, contact_name, contact_phone, 
                    address_line1, address_line2, landmark, city, 
                    state, postal_code, latitude, longitude, is_default
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId || null,
                    label || 'Home',
                    contact_name || '',
                    contact_phone || '',
                    address_line1 || '',
                    address_line2 || null,
                    landmark || null,
                    city || '',
                    state || null,
                    postal_code || null,
                    latitude || null,
                    longitude || null,
                    is_default || false
                ]
            );

            await connection.commit();
            return result.insertId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async update(id, userId, addressData) {
        const { label, contact_name, contact_phone, address_line1, address_line2, landmark, city, state, postal_code, latitude, longitude, is_default } = addressData;

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            if (is_default) {
                await connection.execute('UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?', [userId]);
            }

            await connection.execute(
                `UPDATE user_addresses SET 
                    label = ?, contact_name = ?, contact_phone = ?, 
                    address_line1 = ?, address_line2 = ?, landmark = ?, 
                    city = ?, state = ?, postal_code = ?, 
                    latitude = ?, longitude = ?, is_default = ?
                WHERE id = ? AND user_id = ?`,
                [
                    label || 'Home',
                    contact_name || '',
                    contact_phone || '',
                    address_line1 || '',
                    address_line2 || null,
                    landmark || null,
                    city || '',
                    state || null,
                    postal_code || null,
                    latitude || null,
                    longitude || null,
                    is_default || false,
                    id || null,
                    userId || null
                ]
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

    static async delete(id, userId) {
        const [result] = await db.execute(
            'UPDATE user_addresses SET is_deleted = TRUE WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        return result.affectedRows > 0;
    }

    static async findByUserId(userId) {
        const [rows] = await db.execute(
            'SELECT * FROM user_addresses WHERE user_id = ? AND is_deleted = FALSE ORDER BY is_default DESC, created_at DESC',
            [userId || null]
        );
        return rows;
    }

    static async findById(id, userId) {
        const [rows] = await db.execute(
            'SELECT * FROM user_addresses WHERE id = ? AND user_id = ? AND is_deleted = FALSE',
            [id, userId]
        );
        return rows[0];
    }

    static async setDefault(id, userId) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?', [userId || null]);
            await connection.execute('UPDATE user_addresses SET is_default = TRUE WHERE id = ? AND user_id = ?', [id || null, userId || null]);
            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = Address;
