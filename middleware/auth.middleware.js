const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

exports.isAuthenticated = async (req, res, next) => {
    if (req.session.userId) {
        try {
            const user = await User.findById(req.session.userId);
            if (user) {
                req.user = user;
                return next();
            }
        } catch (error) {
            console.error('Auth middleware error:', error);
        }
    }

    // Handle AJAX/JSON requests
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required',
            redirect: '/auth/login'
        });
    }

    res.redirect('/auth/login');
};

exports.loadUser = async (req, res, next) => {
    if (req.session.userId) {
        try {
            const user = await User.findById(req.session.userId);
            if (user) {
                req.user = user;
                res.locals.user = user;
            }
        } catch (error) {
            console.error('LoadUser middleware error:', error);
        }
    }
    next();
};

exports.isNotAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return res.redirect('/customer/dashboard');
    }
    next();
};
