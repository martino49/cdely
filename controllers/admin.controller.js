const User = require('../models/User.model');
const Store = require('../models/Store.model');
const Order = require('../models/Order.model');

exports.getDashboard = async (req, res) => {
    try {
        const stats = {
            users: await User.count(),
            stores: await Store.count(),
            orders: await Order.count(),
            revenue: await Order.totalRevenue()
        };
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats,
            user: req.user
        });
    } catch (error) {
        console.error('getDashboard error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const users = await User.findAll();
        res.render('admin/users', {
            title: 'User Management',
            users,
            user: req.user
        });
    } catch (error) {
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.getStores = async (req, res) => {
    try {
        const pendingStores = await Store.findAllPending();
        res.render('admin/stores', {
            title: 'Store Approvals',
            stores: pendingStores,
            user: req.user
        });
    } catch (error) {
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.approveStore = async (req, res) => {
    try {
        const { storeId, action } = req.body;
        if (!storeId) return res.status(400).json({ success: false, message: 'Store ID is required' });
        const isApproved = action === 'approve';
        await Store.updateStatus(storeId, isApproved);
        res.json({ success: true, message: `Store ${isApproved ? 'approved' : 'rejected'} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ success: false, message: 'User ID is required' });
        await User.delete(id);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
