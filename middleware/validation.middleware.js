const { body, query, param, validationResult } = require('express-validator');
const User = require('../models/User.model');
const db = require('../config/database'); // Need db for phone check

// Common validation rules
const commonRules = {
    email: body('email')
        .isEmail().withMessage('Please enter a valid email')
        .normalizeEmail()
        .custom(async (email, { req }) => {
            const user = await User.findByEmail(email);
            if (user && (!req.user || user.id !== req.user.id)) {
                throw new Error('Email already in use');
            }
            return true;
        }),

    phone: body('phone')
        .isMobilePhone().withMessage('Please enter a valid phone number')
        .custom(async (phone, { req }) => {
            // Check if phone already exists
            const [rows] = await db.execute(
                'SELECT id FROM users WHERE phone = ? AND id != ?',
                [phone, req.user?.id || 0]
            );
            if (rows.length > 0) {
                throw new Error('Phone number already in use');
            }
            return true;
        }),

    password: body('password')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
        .matches(/\d/).withMessage('Password must contain a number'),

    name: body('name')
        .trim()
        .isLength({ min: 2 }).withMessage('Name must be at least 2 characters')
        .escape(),

    price: body('price')
        .isFloat({ min: 0 }).withMessage('Price must be a positive number'),

    quantity: body('quantity')
        .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),

    coordinates: body(['latitude', 'longitude'])
        .isFloat().withMessage('Invalid coordinates'),

    address: body('address')
        .trim()
        .isLength({ min: 5 }).withMessage('Address is too short')
        .escape()
};

// Validation middleware factory
function validate(validations) {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        const errorMessages = errors.array().map(err => err.msg);
        res.status(400).json({
            success: false,
            errors: errorMessages
        });
    };
}

// Specific validation sets
exports.validateRegister = validate([
    commonRules.email,
    commonRules.password,
    commonRules.name,
    body('user_type')
        .isIn(['customer', 'seller', 'rider'])
        .withMessage('Invalid user type'),
    body('confirm_password')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        })
]);

exports.validateLogin = validate([
    body('email').isEmail().withMessage('Invalid email'),
    body('password').notEmpty().withMessage('Password is required')
]);

exports.validateProduct = validate([
    commonRules.name,
    body('description')
        .trim()
        .isLength({ min: 10 }).withMessage('Description must be at least 10 characters')
        .escape(),
    commonRules.price,
    body('category').notEmpty().withMessage('Category is required'),
    body('stock_quantity').optional().isInt({ min: 0 }),
    body('attributes').optional().isJSON()
]);

exports.validateOrder = validate([
    body('store_id').isInt().withMessage('Invalid store'),
    body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
    body('items.*.product_id').isInt().withMessage('Invalid product'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Invalid quantity'),
    body('delivery_address').notEmpty().withMessage('Delivery address is required'),
    body('payment_method')
        .isIn(['cash', 'card', 'mobile_money'])
        .withMessage('Invalid payment method')
]);

exports.validatePayment = validate([
    body('amount').isFloat({ min: 0 }).withMessage('Invalid amount'),
    body('payment_method').notEmpty().withMessage('Payment method is required'),
    body('order_id').optional().isInt()
]);

exports.validateStore = validate([
    commonRules.name,
    body('description').trim().isLength({ min: 20 }).escape(),
    body('category').notEmpty().withMessage('Category is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('phone').optional().isMobilePhone(),
    body('email').optional().isEmail(),
    body('minimum_order').optional().isFloat({ min: 0 }),
    body('preparation_time').optional().isInt({ min: 5 })
]);

// Query validation
exports.validatePagination = validate([
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
]);

// Params validation
exports.validateIdParam = validate([
    param('id').isInt().withMessage('Invalid ID')
]);

// File validation
exports.validateFile = (fieldName, maxCount = 1) => {
    return (req, res, next) => {
        if (!req.files || !req.files[fieldName]) {
            if (maxCount > 1) {
                if (!req.files || req.files.length === 0) {
                    return res.status(400).json({ error: `No ${fieldName} uploaded` });
                }
            } else {
                return res.status(400).json({ error: `No ${fieldName} uploaded` });
            }
        }

        if (maxCount > 1 && req.files.length > maxCount) {
            return res.status(400).json({ error: `Maximum ${maxCount} files allowed` });
        }

        next();
    };
};

// Custom validation for business logic
exports.validateOrderStatusChange = (req, res, next) => {
    const allowedTransitions = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['preparing', 'cancelled'],
        preparing: ['ready_for_pickup', 'cancelled'],
        ready_for_pickup: ['picked_up', 'cancelled'],
        picked_up: ['in_transit'],
        in_transit: ['delivered'],
        delivered: [],
        cancelled: []
    };

    const currentStatus = req.order.order_status;
    const newStatus = req.body.status;

    if (!allowedTransitions[currentStatus].includes(newStatus)) {
        return res.status(400).json({
            error: `Cannot change status from ${currentStatus} to ${newStatus}`
        });
    }

    next();
};

// Sanitize middleware
exports.sanitizeInput = (req, res, next) => {
    // Sanitize all string inputs in body
    if (req.body) {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key]
                    .replace(/[<>]/g, '')
                    .trim()
                    .substring(0, 1000);
            }
        }
    }

    // Sanitize query params
    if (req.query) {
        for (const key in req.query) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = req.query[key]
                    .replace(/[<>]/g, '')
                    .trim();
            }
        }
    }

    next();
};
