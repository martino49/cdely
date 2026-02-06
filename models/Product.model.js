const db = require('../config/database');

class Product {
    // Create product
    static async create(productData) {
        const [result] = await db.execute(
            `INSERT INTO products (
                store_id, name, description, category, price, 
                compare_at_price, image_urls, stock_quantity, attributes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                productData.store_id || null,
                productData.name || '',
                productData.description || '',
                productData.category || '',
                productData.price || 0,
                productData.compare_at_price || null,
                JSON.stringify(productData.image_urls || []),
                productData.stock_quantity || 0,
                JSON.stringify(productData.attributes || {})
            ]
        );
        return result.insertId;
    }

    // Find product by ID
    static async findById(id) {
        const [rows] = await db.execute(
            `SELECT p.*, s.name as store_name, s.logo_url as store_logo,
                    s.rating as store_rating
             FROM products p
             JOIN stores s ON p.store_id = s.id
             WHERE p.id = ? AND p.is_available = TRUE`,
            [id]
        );
        return rows[0];
    }

    // Find products by store
    static async findByStoreId(storeId, category = null, limit = 50, offset = 0) {
        let query = `
            SELECT p.*
            FROM products p
            WHERE p.store_id = ? AND p.is_available = TRUE
        `;

        const params = [storeId || null];

        if (category) {
            query += ' AND p.category = ?';
            params.push(category);
        }

        query += ` ORDER BY p.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

        const [rows] = await db.execute(query, params);
        return rows;
    }

    // Search products
    static async search(searchTerm, category = null, minPrice = null, maxPrice = null, limit = 20, offset = 0) {
        let query = `
            SELECT p.*, s.name as store_name, s.logo_url as store_logo,
                   s.rating as store_rating, s.delivery_time
            FROM products p
            JOIN stores s ON p.store_id = s.id
            WHERE p.is_available = TRUE 
            AND s.is_open = TRUE
            AND (p.name LIKE ? OR p.description LIKE ?)
        `;

        const params = [`%${searchTerm || ''}%`, `%${searchTerm || ''}%`];

        if (category) {
            query += ' AND p.category = ?';
            params.push(category);
        }

        if (minPrice !== null) {
            query += ' AND p.price >= ?';
            params.push(minPrice);
        }

        if (maxPrice !== null) {
            query += ' AND p.price <= ?';
            params.push(maxPrice);
        }

        query += ` ORDER BY p.created_at DESC LIMIT ${parseInt(limit) || 20} OFFSET ${parseInt(offset) || 0}`;

        const [rows] = await db.execute(query, params);
        return rows;
    }

    // Update product
    static async update(id, updateData) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'name', 'description', 'category', 'price', 'compare_at_price',
            'image_urls', 'stock_quantity', 'is_available', 'attributes'
        ];

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                fields.push(`${field} = ?`);

                // Handle JSON fields
                if (field === 'image_urls' || field === 'attributes') {
                    values.push(JSON.stringify(updateData[field]));
                } else {
                    values.push(updateData[field]);
                }
            }
        }

        if (fields.length === 0) return false;

        values.push(id);

        const [result] = await db.execute(
            `UPDATE products SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    // Delete product (soft delete)
    static async delete(id) {
        const [result] = await db.execute(
            'UPDATE products SET is_available = FALSE WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }

    // Update stock
    static async updateStock(productId, quantityChange) {
        const [result] = await db.execute(
            'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
            [quantityChange || 0, productId || null]
        );
        return result.affectedRows > 0;
    }

    // Get featured products
    static async getFeatured(limit = 10) {
        const [rows] = await db.execute(
            `SELECT p.*, s.name as store_name, s.logo_url as store_logo
             FROM products p
             JOIN stores s ON p.store_id = s.id
             WHERE p.is_available = TRUE 
             AND s.is_open = TRUE
             AND p.compare_at_price IS NOT NULL
             LIMIT ${parseInt(limit) || 10}`,
            []
        );
        return rows;
    }

    // Get products by category
    static async getByCategory(category, limit = 20, offset = 0) {
        const [rows] = await db.execute(
            `SELECT p.*, s.name as store_name, s.logo_url as store_logo
             FROM products p
             JOIN stores s ON p.store_id = s.id
             WHERE p.category = ? 
             AND p.is_available = TRUE
              AND s.is_open = TRUE
             ORDER BY p.created_at DESC
             LIMIT ${parseInt(limit) || 20} OFFSET ${parseInt(offset) || 0}`,
            [category || '']
        );
        return rows;
    }

    static async countByStoreId(storeId) {
        const [rows] = await db.execute('SELECT COUNT(*) as count FROM products WHERE store_id = ?', [storeId || null]);
        return rows[0].count;
    }

    static async findAll(options = {}) {
        const limit = parseInt(options.limit) || 20;
        const offset = parseInt(options.offset) || 0;

        const [rows] = await db.execute(
            `SELECT p.*, s.name as store_name, s.logo_url as store_logo
             FROM products p
             JOIN stores s ON p.store_id = s.id
             WHERE p.is_available = TRUE 
             AND s.is_open = TRUE
             ORDER BY p.created_at DESC
             LIMIT ${limit} OFFSET ${offset}`,
            []
        );
        return rows;
    }
}

module.exports = Product;
