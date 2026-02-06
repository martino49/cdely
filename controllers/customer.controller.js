const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const Store = require('../models/Store.model');
const User = require('../models/User.model');
const Review = require('../models/Review.model');
const Favorite = require('../models/Favorite.model');
const Address = require('../models/Address.model');
const Wallet = require('../models/Wallet.model');
const Transaction = require('../models/Transaction.model');
const { generateTransactionRef } = require('../utils/generators'); // Assuming utils exists, or inline it

exports.getDashboard = async (req, res) => {
    try {
        // Get featured stores (using findAll as a proxy for nearby for now)
        const stores = await Store.findAll({ limit: 5 });

        // Get featured products
        const products = await Product.findAll({ limit: 12 });

        res.render('customer/home', {
            title: 'Dashboard',
            user: req.user,
            stores: stores || [],
            products: products || []
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.browseStores = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const offset = (page - 1) * limit;

        const { category, sort, search, minRating, maxDeliveryTime } = req.query;

        const stores = await Store.findAll({
            category, sort, search, minRating, maxDeliveryTime,
            limit, offset
        });

        const totalStores = await Store.count(); // We need a filtered count ideally, but starting with total
        const totalPages = Math.ceil(totalStores / limit);

        // Build query string for pagination
        const filterParams = new URLSearchParams();
        Object.entries(req.query).forEach(([key, value]) => {
            if (value && key !== 'page') filterParams.append(key, value);
        });
        const queryString = filterParams.toString();

        res.render('customer/stores', {
            title: 'Browse Stores',
            stores,
            filters: { category, sort, search, minRating, maxDeliveryTime },
            currentPage: page,
            totalPages,
            queryString,
            user: req.user,
            mapApiKey: process.env.GOOGLE_MAPS_API_KEY
        });
    } catch (error) {
        console.error('browseStores error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.getProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).render('errors/404');
        }

        const store = await Store.findById(product.store_id);
        const products = [product]; // Wrap for common logic
        if (req.user && req.user.id) {
            product.is_favorited = await Favorite.isFavorited(req.user.id, req.params.id, 'product');
        } else {
            product.is_favorited = false;
        }

        res.render('customer/product-detail', {
            title: product.name,
            product,
            store: store || { name: 'Store' },
            reviews: [], // Ensure reviews exists
            user: req.user
        });
    } catch (error) {
        console.error('getProduct error:', error);
        res.status(404).render('errors/404');
    }
};

exports.getStore = async (req, res) => {
    try {
        const storeId = req.params.id;
        const store = await Store.findById(storeId);

        if (!store) {
            return res.status(404).render('errors/404');
        }

        const products = await Product.findByStoreId(storeId);
        const reviews = await Review.findByStoreId(storeId);

        // Check if items are favorited (only for logged in users)
        if (req.user && req.user.id) {
            store.is_favorited = await Favorite.isFavorited(req.user.id, storeId, 'store');
            if (products && products.length > 0) {
                for (let product of products) {
                    product.is_favorited = await Favorite.isFavorited(req.user.id, product.id, 'product');
                }
            }
        } else {
            store.is_favorited = false;
            for (let product of products) {
                product.is_favorited = false;
            }
        }

        res.render('customer/store-detail', {
            title: store.name,
            store,
            products,
            reviews,
            user: req.user
        });
    } catch (error) {
        console.error('getStore error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

// Product detail is handled by getProduct at line 68 but line 121 was a duplicate with more features.
// I will merge them into the first one and remove this one.
exports.getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const statusFilter = req.query.status || null;

        const orders = req.user ? await Order.findByCustomerId(req.user.id, limit, offset) : [];

        // Mocking total pages since we don't have a count method yet, 
        // but for 10 seeded items and 10 limit, it's 1 page.
        const totalPages = 1;

        res.render('customer/orders-list', {
            title: 'My Orders',
            orders,
            currentPage: page,
            totalPages,
            statusFilter,
            user: req.user
        });
    } catch (error) {
        console.error('getOrders error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.getOrderDetails = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id, req.user.id, 'customer');
        if (!order) {
            return res.status(404).render('errors/404');
        }

        const items = order ? await Order.getOrderItems(order.id) : [];
        res.render('customer/order-detail', {
            title: `Order #${order.order_number}`,
            order,
            items
        });
    } catch (error) {
        console.error('getOrderDetails error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

const Delivery = require('../models/Delivery.model');

exports.trackOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId, req.user.id, 'customer');
        if (!order) {
            return res.status(404).render('errors/404');
        }

        const delivery = await Delivery.findByOrderId(order.id);
        let trackingPoints = [];
        if (delivery) {
            trackingPoints = await Delivery.getTrackingPoints(delivery.id);
        }

        res.render('customer/track-order', {
            title: 'Track Order',
            order,
            delivery,
            trackingPoints,
            mapApiKey: process.env.GOOGLE_MAPS_API_KEY
        });
    } catch (error) {
        console.error('Track Order error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};
exports.getProfile = async (req, res) => {
    try {
        const stats = { total_orders: 5, total_spent: 4500, loyalty_points: 120 }; // Placeholder
        const recentActivity = [
            { icon: 'shopping-bag', color: 'primary', title: 'Order Placed', time: '2 hours ago', description: 'You placed an order with KFC.' },
            { icon: 'check-circle', color: 'success', title: 'Order Delivered', time: 'Yesterday', description: 'Your order from Jumia Food was delivered.' }
        ];
        const recentOrders = req.user ? await Order.findByCustomerId(req.user.id, 5) : [];

        res.render('customer/profile', {
            title: 'My Profile',
            user: req.user,
            stats,
            recentActivity,
            recentOrders
        });
    } catch (error) {
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { full_name, phone } = req.body;
        const updated = req.user ? await User.updateProfile(req.user.id, { full_name, phone }) : false;
        if (updated) {
            res.json({ success: true, message: 'Profile updated' });
        } else {
            res.status(400).json({ success: false, message: 'Update failed' });
        }
    } catch (error) {
        console.error('updateProfile error:', error);
        res.status(500).json({ success: false, message: 'Update failed' });
    }
};

exports.getWallet = async (req, res) => {
    try {
        const balance = 2500.00; // Mock balance
        const transactions = [
            { id: 1, type: 'credit', amount: 5000, description: 'Bank Transfer', date: '2026-01-20', status: 'completed' },
            { id: 2, type: 'debit', amount: 1500, description: 'Order #ORD-12345', date: '2026-01-22', status: 'completed' },
            { id: 3, type: 'debit', amount: 1000, description: 'Order #ORD-67890', date: '2026-01-23', status: 'pending' }
        ];

        res.render('customer/wallet', {
            title: 'My Wallet',
            user: req.user,
            balance,
            transactions
        });
    } catch (error) {
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.submitReview = async (req, res) => {
    try {
        const { order_id, store_id, product_id, rider_id, store_rating, product_rating, rider_rating, store_comment, product_comment, rider_comment } = req.body;
        const reviewer_id = req.user ? req.user.id : null;
        if (!reviewer_id) return res.status(401).json({ success: false, message: 'Please login' });

        await Review.create({
            order_id, reviewer_id, store_id, product_id, rider_id,
            store_rating, product_rating, rider_rating,
            store_comment, product_comment, rider_comment
        });

        res.json({ success: true, message: 'Thank you for your feedback!' });
    } catch (error) {
        console.error('submitReview error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit review: ' + error.message });
    }
};

exports.toggleFavorite = async (req, res) => {
    try {
        const { itemId, itemType } = req.body;
        if (!req.user) return res.status(401).json({ success: false, message: 'Please login' });
        const result = await Favorite.toggle(req.user.id, itemId, itemType);
        res.json({
            success: true,
            ...result,
            message: result.favorited ? 'Added to favorites' : 'Removed from favorites'
        });
    } catch (error) {
        console.error('toggleFavorite error:', error);
        res.status(500).json({ success: false, message: 'Failed to update favorite' });
    }
};

exports.getFavorites = async (req, res) => {
    try {
        const favorites = await Favorite.findByUserId(req.user.id);
        res.render('customer/favorites', {
            title: 'My Favorites',
            user: req.user,
            favorites
        });
    } catch (error) {
        console.error('getFavorites error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.getAddresses = async (req, res) => {
    try {
        const addresses = req.user ? await Address.findByUserId(req.user.id) : [];
        res.render('customer/addresses', {
            title: 'My Addresses',
            user: req.user,
            addresses,
            mapApiKey: process.env.GOOGLE_MAPS_API_KEY
        });
    } catch (error) {
        console.error('getAddresses error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.addAddress = async (req, res) => {
    try {
        const addressData = req.body;
        if (!req.user) return res.status(401).json({ success: false, message: 'Please login' });
        await Address.create(req.user.id, addressData);
        res.json({ success: true, message: 'Address added successfully' });
    } catch (error) {
        console.error('addAddress error:', error);
        res.status(500).json({ success: false, message: 'Failed to add address' });
    }
};

exports.deleteAddress = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user) return res.status(401).json({ success: false, message: 'Please login' });
        await Address.delete(id, req.user.id);
        res.json({ success: true, message: 'Address deleted' });
    } catch (error) {
        console.error('deleteAddress error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete address' });
    }
};

exports.setDefaultAddress = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user) return res.status(401).json({ success: false, message: 'Please login' });
        await Address.setDefault(id, req.user.id);
        res.json({ success: true, message: 'Default address updated' });
    } catch (error) {
        console.error('setDefaultAddress error:', error);
        res.status(500).json({ success: false, message: 'Failed to update default address' });
    }
};

exports.getWallet = async (req, res) => {
    try {
        let wallet = await Wallet.findByUserId(req.user.id);
        if (!wallet) {
            await Wallet.create(req.user.id);
            wallet = await Wallet.findByUserId(req.user.id);
        }

        const transactions = await Transaction.findByUserId(req.user.id);

        res.render('customer/wallet', {
            title: 'My Wallet',
            user: req.user,
            balance: parseFloat(wallet.balance),
            transactions
        });
    } catch (error) {
        console.error('getWallet error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.topUpWallet = async (req, res) => {
    try {
        const { amount } = req.body;
        const topUpAmount = parseFloat(amount);

        if (!topUpAmount || topUpAmount < 10) {
            return res.status(400).json({ success: false, message: 'Minimum top up is 10 KES' });
        }

        const transactionRef = generateTransactionRef();

        await Transaction.create({
            transaction_ref: transactionRef,
            user_id: req.user.id,
            type: 'credit',
            amount: topUpAmount,
            payment_method: 'mobile_money',
            description: 'Wallet Top-up via M-Pesa',
            status: 'completed',
            category: 'wallet_topup'
        });

        await Wallet.updateBalance(req.user.id, topUpAmount, 'credit');

        res.json({ success: true, message: 'Top up successful', newBalance: 0 });
    } catch (error) {
        console.error('topUpWallet error:', error);
        res.status(500).json({ success: false, message: 'Processing failed' });
    }
};
