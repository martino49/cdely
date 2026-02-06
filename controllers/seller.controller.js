const Store = require('../models/Store.model');
const Product = require('../models/Product.model');
const Order = require('../models/Order.model');

exports.getDashboard = async (req, res) => {
    try {
        const store = await Store.findBySellerId(req.user.id);
        if (!store) {
            return res.render('seller/dashboard', {
                title: 'Seller Dashboard',
                error: 'No store found for your account.',
                store: null,
                stats: { orders: 0, products: 0, revenue: 0, pendingOrders: 0 },
                recentOrders: [],
                analytics: { dailySales: '[]', categoryData: '[]' },
                user: req.user
            });
        }

        const stats = {
            orders: await Order.countByStoreId(store.id),
            products: await Product.countByStoreId(store.id),
            revenue: await Order.revenueByStoreId(store.id),
            pendingOrders: await Order.findByStoreId(store.id, 'pending').then(orders => (orders || []).length)
        };

        const recentOrders = await Order.findByStoreId(store.id, null, 5);
        const dailySales = await Order.getDailySales(store.id);
        const categoryData = await Order.getCategoryDistribution(store.id);

        res.render('seller/dashboard', {
            title: 'Seller Dashboard',
            stats,
            recentOrders,
            store,
            analytics: {
                dailySales: JSON.stringify(dailySales),
                categoryData: JSON.stringify(categoryData)
            },
            user: req.user
        });
    } catch (error) {
        console.error('Seller Dashboard error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.getProducts = async (req, res) => {
    try {
        const store = await Store.findBySellerId(req.user.id);
        const products = store ? await Product.findByStoreId(store.id) : [];
        res.render('seller/products', {
            title: 'Manage Products',
            products,
            store: store || null,
            user: req.user
        });
    } catch (error) {
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.getOrders = async (req, res) => {
    try {
        const store = await Store.findBySellerId(req.user.id);
        const status = req.query.status || null;
        const orders = store ? await Order.findByStoreId(store.id, status) : [];
        res.render('seller/orders', {
            title: 'Store Orders',
            orders,
            store: store || null,
            currentStatus: status,
            user: req.user
        });
    } catch (error) {
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status, notes } = req.body;
        const store = await Store.findBySellerId(req.user.id);

        // Verify order belongs to this store
        const order = await Order.findById(orderId);
        if (!order || !store || order.store_id !== store.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized or store not found' });
        }

        const updated = await Order.updateStatus(orderId, status, notes);
        if (updated) {
            res.json({ success: true, message: `Order updated to ${status}` });
        } else {
            res.status(400).json({ success: false, message: 'Update failed' });
        }
    } catch (error) {
        console.error('updateOrderStatus error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createStore = async (req, res) => {
    try {
        const { name, description, category, address, phone } = req.body;

        // Basic validation
        if (!name || !category || !address) {
            return res.status(400).json({ success: false, message: 'Please fill in all required fields' });
        }

        const existingStore = await Store.findBySellerId(req.user.id);
        if (existingStore) {
            return res.status(400).json({ success: false, message: 'You already have a store' });
        }

        // Ensure user exists in sellers table
        try {
            await db.execute(
                'INSERT INTO sellers (id, store_name) VALUES (?, ?)',
                [req.user.id, name]
            );
        } catch (error) {
            // Ignore duplicate entry error (seller already exists), re-throw others
            if (error.code !== 'ER_DUP_ENTRY') {
                throw error;
            }
        }

        const storeData = {
            seller_id: req.user.id,
            name,
            slug: (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')) || `store-${Date.now()}`,
            description,
            category,
            address,
            phone,
            latitude: -1.2921, // Defaulting for now, can be updated later via map
            longitude: 36.8219
        };

        const storeId = await Store.create(storeData);
        res.json({ success: true, message: 'Store created successfully', storeId });
    } catch (error) {
        console.error('createStore error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Store name already exists' });
        }
        res.status(500).json({ success: false, message: 'Failed to create store' });
    }
};

exports.addProduct = async (req, res) => {
    try {
        const store = await Store.findBySellerId(req.user.id);
        const productData = {
            ...req.body,
            store_id: store ? store.id : null,
            image_urls: req.body.image_urls ? (typeof req.body.image_urls === 'string' ? [req.body.image_urls] : req.body.image_urls) : []
        };
        if (!productData.store_id) return res.status(400).json({ success: false, message: 'Store not found' });

        const productId = await Product.create(productData);
        res.json({ success: true, message: 'Product added successfully', productId });
    } catch (error) {
        console.error('addProduct error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const store = await Store.findBySellerId(req.user.id);

        // Verify product belongs to store
        const product = await Product.findById(id);
        if (!product || product.store_id !== store.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const updated = await Product.update(id, req.body);
        if (updated) {
            res.json({ success: true, message: 'Product updated successfully' });
        } else {
            res.status(400).json({ success: false, message: 'Update failed' });
        }
    } catch (error) {
        console.error('updateProduct error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const store = await Store.findBySellerId(req.user.id);

        const product = await Product.findById(id);
        if (!product || product.store_id !== store.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await Product.delete(id);
        res.json({ success: true, message: 'Product removed from catalog' });
    } catch (error) {
        console.error('deleteProduct error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const store = await Store.findBySellerId(req.user.id);
        res.render('seller/profile', {
            title: 'Store Profile',
            store: store || null,
            user: req.user
        });
    } catch (error) {
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const store = await Store.findBySellerId(req.user.id);
        const { name, description, address, category, preparation_time, is_open } = req.body;

        // In a real app, you'd have a Store.update method. 
        // For now, let's assume we can update these fields.
        const [result] = await db.execute(
            `UPDATE stores 
             SET name = ?, description = ?, address = ?, category = ?, 
                 preparation_time = ?, is_open = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [name, description, address, category, preparation_time, is_open === 'on', store ? store.id : null]
        );

        if (store && result.affectedRows > 0) {
            res.redirect('/seller/profile?success=1');
        } else {
            res.redirect('/seller/profile?error=1');
        }
    } catch (error) {
        console.error('updateProfile error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.getWallet = async (req, res) => {
    try {
        const store = await Store.findBySellerId(req.user.id);
        const stats = {
            totalEarnings: store ? await Order.revenueByStoreId(store.id) : 0,
            pendingPayout: 0,
            lastPayout: 'N/A'
        };

        const transactions = store ? [] : []; // Placeholder

        res.render('seller/wallet', {
            title: 'Financial Wallet',
            stats,
            transactions,
            store: store || null,
            user: req.user
        });
    } catch (error) {
        res.status(500).render('errors/500', { error: error.message });
    }
};
const db = require('../config/database');
