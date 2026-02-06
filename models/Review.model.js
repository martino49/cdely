const db = require('../config/database');

class Review {
    static async create(reviewData) {
        const {
            order_id,
            reviewer_id,
            store_id,
            product_id,
            rider_id,
            store_rating,
            product_rating,
            rider_rating,
            store_comment,
            product_comment,
            rider_comment,
            images
        } = reviewData;

        const [result] = await db.execute(
            `INSERT INTO reviews (
                order_id, reviewer_id, reviewed_id, review_type,
                rating, comment, images
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                order_id || null, reviewer_id || null,
                store_id || product_id || rider_id || null,
                store_id ? 'store' : (product_id ? 'product' : 'rider'),
                store_rating || product_rating || rider_rating || 0,
                store_comment || product_comment || rider_comment || '',
                images ? JSON.stringify(images) : null
            ]
        );
        return result.insertId;
    }

    static async findByStoreId(storeId, limit = 10, offset = 0) {
        const [rows] = await db.execute(
            `SELECT r.*, u.full_name as reviewer_name, u.profile_picture as reviewer_avatar
             FROM reviews r
             JOIN users u ON r.reviewer_id = u.id
             WHERE r.reviewed_id = ? AND r.review_type = 'store'
             ORDER BY r.created_at DESC
             LIMIT ${parseInt(limit) || 10} OFFSET ${parseInt(offset) || 0}`,
            [storeId || null]
        );
        return rows;
    }

    static async findByProductId(productId, limit = 10, offset = 0) {
        const [rows] = await db.execute(
            `SELECT r.*, u.full_name as reviewer_name, u.profile_picture as reviewer_avatar
             FROM reviews r
             JOIN users u ON r.reviewer_id = u.id
             WHERE r.reviewed_id = ? AND r.review_type = 'product'
             ORDER BY r.created_at DESC
             LIMIT ${parseInt(limit) || 10} OFFSET ${parseInt(offset) || 0}`,
            [productId || null]
        );
        return rows;
    }

    static async getStatsForStore(storeId) {
        const [rows] = await db.execute(
            `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
             FROM reviews
             WHERE reviewed_id = ? AND review_type = 'store'`,
            [storeId || null]
        );
        return rows[0];
    }
}

module.exports = Review;
