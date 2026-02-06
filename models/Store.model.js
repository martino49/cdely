const db = require('../config/database');

class Store {
    static async findById(id) {
        const [rows] = await db.execute('SELECT * FROM stores WHERE id = ?', [id || null]);
        return rows[0];
    }

    static async create(storeData) {
        const [result] = await db.execute(
            `INSERT INTO stores (
                seller_id, name, slug, description, category, 
                address, phone, latitude, longitude, is_approved
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
            [
                storeData.seller_id,
                storeData.name,
                storeData.slug,
                storeData.description || '',
                storeData.category || 'other',
                storeData.address || '',
                storeData.phone || '',
                storeData.latitude || 0,
                storeData.longitude || 0
            ]
        );
        return result.insertId;
    }

    static async findNearby(location) {
        // Placeholder for geospatial query
        const [rows] = await db.execute('SELECT * FROM stores LIMIT 10', []);
        return rows;
    }

    static async findAll(filters = {}) {
        let query = 'SELECT * FROM stores WHERE is_deleted = FALSE AND is_approved = TRUE';
        const params = [];

        if (filters.category && filters.category !== '') {
            query += ' AND category = ?';
            params.push(filters.category);
        }

        if (filters.search && filters.search !== '') {
            query += ' AND (name LIKE ? OR description LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        if (filters.minRating) {
            query += ' AND rating >= ?';
            params.push(parseFloat(filters.minRating));
        }

        if (filters.maxDeliveryTime) {
            query += ' AND preparation_time <= ?';
            params.push(parseInt(filters.maxDeliveryTime));
        }

        if (filters.sort === 'rating') {
            query += ' ORDER BY rating DESC';
        } else if (filters.sort === 'delivery_time') {
            query += ' ORDER BY preparation_time ASC';
        } else if (filters.sort === 'newest') {
            query += ' ORDER BY created_at DESC';
        } else {
            query += ' ORDER BY is_featured DESC, rating DESC';
        }

        const limit = parseInt(filters.limit) || 12;
        const offset = parseInt(filters.offset) || 0;
        query += ` LIMIT ${limit} OFFSET ${offset}`;

        const [rows] = await db.execute(query, params);
        return rows;
    }

    static async count() {
        const [rows] = await db.execute('SELECT COUNT(*) as count FROM stores');
        return rows[0].count;
    }

    static async findAllPending() {
        const [rows] = await db.execute(
            `SELECT s.*, u.full_name as seller_name, u.email as seller_email 
             FROM stores s 
             JOIN users u ON s.seller_id = u.id 
             JOIN sellers sel ON u.id = sel.id
             WHERE sel.is_approved = FALSE`
        );
        return rows;
    }

    static async updateStatus(id, isApproved) {
        // First update the seller record
        const [store] = await db.execute('SELECT seller_id FROM stores WHERE id = ?', [id || null]);
        if (store.length > 0) {
            await db.execute('UPDATE sellers SET is_approved = ? WHERE id = ?', [isApproved || false, store[0].seller_id]);
            return true;
        }
        return false;
    }

    static async findBySellerId(sellerId) {
        const [rows] = await db.execute('SELECT * FROM stores WHERE seller_id = ?', [sellerId || null]);
        return rows[0];
    }
}

module.exports = Store;
