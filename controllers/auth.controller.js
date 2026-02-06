const User = require('../models/User.model');
const Cart = require('../models/Cart.model');
const bcrypt = require('bcryptjs');

exports.getLogin = (req, res) => {
    res.render('auth/login', { title: 'Login' });
};

exports.getRegister = (req, res) => {
    res.render('auth/register', { title: 'Register' });
};

exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.render('auth/login', {
                title: 'Login',
                error: 'Email and password are required'
            });
        }

        // Find user
        const user = await User.findByEmail(email);
        if (!user) {
            return res.render('auth/login', {
                title: 'Login',
                error: 'Invalid email or password'
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.render('auth/login', {
                title: 'Login',
                error: 'Invalid email or password'
            });
        }

        // Set session
        req.session.userId = user.id;
        req.session.userType = user.user_type;
        req.session.userName = user.full_name;

        // Handle pending cart item from guest session
        if (req.session.pendingCartItem && user.user_type === 'customer') {
            try {
                const { store_id, product_id, quantity, special_instructions } = req.session.pendingCartItem;
                await Cart.addItem(user.id, store_id, product_id, quantity, special_instructions);
                delete req.session.pendingCartItem;
                req.session.pendingCartItemProcessed = true;

                // Update cart count in session
                const count = await Cart.getCount(user.id);
                req.session.cartCount = count;
            } catch (cartError) {
                console.error('Error adding pending item to cart:', cartError);
            }
        }

        req.session.save(() => {
            if (req.session.pendingCartItemProcessed) {
                delete req.session.pendingCartItemProcessed;
                return res.redirect('/customer/cart');
            }
            // Redirect based on role
            switch (user.user_type) {
                case 'customer':
                    res.redirect('/customer/dashboard');
                    break;
                case 'seller':
                    res.redirect('/seller/dashboard');
                    break;
                case 'rider':
                    res.redirect('/rider/dashboard');
                    break;
                case 'admin':
                    res.redirect('/admin/dashboard');
                    break;
                default:
                    res.redirect('/');
            }
        });

    } catch (error) {
        console.error(error);
        res.render('auth/login', {
            title: 'Login',
            error: 'An error occurred during login'
        });
    }
};

exports.postRegister = async (req, res) => {
    try {
        const { email, password, name, phone, user_type, confirm_password } = req.body;

        if (!email || !password || !name) {
            return res.render('auth/register', {
                title: 'Register',
                error: 'Required fields are missing',
                data: req.body
            });
        }

        // Simple validation
        if (password !== confirm_password) {
            return res.render('auth/register', {
                title: 'Register',
                error: 'Passwords do not match',
                data: req.body
            });
        }

        // Check if user exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.render('auth/register', {
                title: 'Register',
                error: 'Email already registered',
                data: req.body
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const userId = await User.create({
            email,
            password_hash: hashedPassword,
            full_name: name,
            phone,
            user_type
        });

        // Login immediately
        req.session.userId = userId;
        req.session.userType = user_type;
        req.session.userName = name;

        // Handle pending cart item from guest session
        if (req.session.pendingCartItem && user_type === 'customer') {
            try {
                const { store_id, product_id, quantity, special_instructions } = req.session.pendingCartItem;
                await Cart.addItem(userId, store_id, product_id, quantity, special_instructions);
                delete req.session.pendingCartItem;
                req.session.pendingCartItemProcessed = true;

                // Update cart count in session
                const count = await Cart.getCount(userId);
                req.session.cartCount = count;
            } catch (cartError) {
                console.error('Error adding pending item to cart:', cartError);
            }
        }

        req.session.save(() => {
            if (req.session.pendingCartItemProcessed) {
                delete req.session.pendingCartItemProcessed;
                return res.redirect('/customer/cart');
            }
            res.redirect('/' + user_type + '/dashboard');
        });

    } catch (error) {
        console.error(error);
        res.render('auth/register', {
            title: 'Register',
            error: 'Registration failed: ' + error.message,
            data: req.body
        });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/auth/login');
    });
};

exports.getForgotPassword = (req, res) => {
    res.render('auth/forgot-password', { title: 'Forgot Password' });
};

exports.postForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findByEmail(email);

        // Security best practice: don't reveal if user exists
        res.render('auth/forgot-password', {
            title: 'Forgot Password',
            success: 'If an account exists with that email, a reset link has been sent.'
        });

        if (user) {
            // Logic to send email would go here
            console.log(`Password reset link requested for: ${email}`);
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        res.render('auth/forgot-password', {
            title: 'Forgot Password',
            error: 'An error occurred. Please try again later.'
        });
    }
};
