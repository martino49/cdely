const express = require('express');
const router = express.Router();
const Store = require('../models/Store.model');

router.get('/', async (req, res) => {
    try {
        if (req.session && req.session.userId) {
            const userType = req.session.userType || 'customer';
            return res.redirect(`/${userType}/dashboard`);
        }

        // Fetch stores for guest view
        const stores = await Store.findAll({ limit: 5 });

        res.render('customer/home', {
            title: 'QuickDeliver | Food & Groceries',
            stores: stores || [],
            orders: [],
            user: null
        });
    } catch (error) {
        console.error('Home page error:', error);
        res.render('customer/home', {
            title: 'Home',
            stores: [],
            orders: []
        });
    }
});

module.exports = router;
