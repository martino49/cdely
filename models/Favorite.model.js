const db = require('../config/database');

class Favorite {
    static async toggle(userId, itemId, itemType) {
        const [rows] = await db.execute(
            'SELECT id FROM favorites WHERE user_id = ? AND item_id = ? AND item_type = ?',
            [userId, itemId, itemType]
        );

        if (rows.length > 0) {
            await db.execute(
                'DELETE FROM favorites WHERE user_id = ? AND item_id = ? AND item_type = ?',
                [userId, itemId, itemType]
            );
            return { favorited: false };
        } else {
            await db.execute(
                'INSERT INTO favorites (user_id, item_id, item_type) VALUES (?, ?, ?)',
                [userId, itemId, itemType]
            );
            return { favorited: true };
        }
    }

    static async findByUserId(userId, limit = 50, offset = 0) {
        // This is a complex query because it needs to join with either products or stores
        // For simplicity and performance, we'll fetch them separately or use a UNION
        const [rows] = await db.execute(
            `SELECT f.id, f.item_id, f.item_type, f.created_at,
                    CASE 
                        WHEN f.item_type = 'product' THEN p.name
                        WHEN f.item_type = 'store' THEN s.name
                    END as name,
                    CASE 
                        WHEN f.item_type = 'product' THEN p.main_image
                        WHEN f.item_type = 'store' THEN s.logo_url
                    END as image_url,
                    CASE 
                        WHEN f.item_type = 'product' THEN p.price
                        ELSE NULL
                    END as price,
                    CASE 
                        WHEN f.item_type = 'product' THEN p.discounted_price
                        ELSE NULL
                    END as discounted_price
             FROM favorites f
             LEFT JOIN products p ON f.item_id = p.id AND f.item_type = 'product'
             LEFT JOIN stores s ON f.item_id = s.id AND f.item_type = 'store'
             WHERE f.user_id = ?
             ORDER BY f.created_at DESC
             LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
            [userId]
        );
        return rows;
    }

    static async isFavorited(userId, itemId, itemType) {
        const [rows] = await db.execute(
            'SELECT id FROM favorites WHERE user_id = ? AND item_id = ? AND item_type = ?',
            [userId, itemId, itemType]
        );
        return rows.length > 0;
    }
}

module.exports = Favorite;
