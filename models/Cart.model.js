const db = require('../config/database');

class Cart {
    static async addItem(customerId, storeId, productId, quantity, specialInstructions) {
        // Check if item already in cart
        const [existing] = await db.execute(
            'SELECT id, quantity FROM carts WHERE customer_id = ? AND product_id = ?',
            [customerId, productId]
        );

        if (existing.length > 0) {
            const newQty = existing[0].quantity + parseInt(quantity || 1);
            await db.execute(
                'UPDATE carts SET quantity = ?, special_instructions = ? WHERE id = ?',
                [newQty, specialInstructions || '', existing[0].id]
            );
            return existing[0].id;
        }

        const [result] = await db.execute(
            'INSERT INTO carts (customer_id, store_id, product_id, quantity, special_instructions) VALUES (?, ?, ?, ?, ?)',
            [customerId, storeId, productId, quantity || 1, specialInstructions || '']
        );
        return result.insertId;
    }

    static async getItems(customerId) {
        // Get cart items grouped by store
        const [rows] = await db.execute(`
            SELECT c.*, p.name as product_name, p.price, p.discounted_price, p.image_urls, p.stock_quantity,
                   s.name as store_name, s.logo_url as store_logo
            FROM carts c
            JOIN products p ON c.product_id = p.id
            JOIN stores s ON c.store_id = s.id
            WHERE c.customer_id = ?
        `, [customerId]);

        // Group rows by store
        const storesMap = {};
        rows.forEach(item => {
            if (!storesMap[item.store_id]) {
                storesMap[item.store_id] = {
                    store_id: item.store_id,
                    store_name: item.store_name,
                    store_logo: item.store_logo,
                    items: [],
                    subtotal: 0
                };
            }
            const price = item.discounted_price || item.price;
            item.item_total = price * item.quantity;

            // Parse image_urls if it's a string
            if (typeof item.image_urls === 'string') {
                try {
                    item.images = JSON.parse(item.image_urls);
                } catch (e) {
                    item.images = [];
                }
            } else {
                item.images = item.image_urls || [];
            }

            storesMap[item.store_id].items.push(item);
            storesMap[item.store_id].subtotal += item.item_total;
        });

        return Object.values(storesMap);
    }

    static async getCount(customerId) {
        const [rows] = await db.execute(
            'SELECT SUM(quantity) as count FROM carts WHERE customer_id = ?',
            [customerId]
        );
        return parseInt(rows[0].count) || 0;
    }

    static async updateQuantity(cartId, quantity) {
        await db.execute(
            'UPDATE carts SET quantity = ? WHERE id = ?',
            [quantity, cartId]
        );
    }

    static async removeItem(cartId) {
        await db.execute('DELETE FROM carts WHERE id = ?', [cartId]);
    }

    static async clear(customerId) {
        await db.execute('DELETE FROM carts WHERE customer_id = ?', [customerId]);
    }
}

module.exports = Cart;
