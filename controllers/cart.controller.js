const Cart = require('../models/Cart.model');
const Product = require('../models/Product.model');

exports.addToCart = async (req, res) => {
    try {
        const product_id = req.body.product_id || req.body.productId;
        const store_id = req.body.store_id || req.body.storeId;
        const { quantity, special_instructions } = req.body;

        // Handle unauthenticated user
        if (!req.user) {
            req.session.pendingCartItem = {
                store_id,
                product_id,
                quantity: quantity || 1,
                special_instructions
            };
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                return res.status(401).json({
                    success: false,
                    message: 'Please login to add items to cart',
                    redirect: '/auth/login'
                });
            } else {
                return res.redirect('/auth/login');
            }
        }

        const customerId = req.user.id;

        // Verify product exists and belongs to the store
        const product = await Product.findById(product_id);
        if (!product || product.store_id !== parseInt(store_id)) {
            return res.status(400).json({ success: false, message: 'Invalid product or store' });
        }

        // Add to cart
        await Cart.addItem(customerId, store_id, product_id, quantity, special_instructions);

        // Get updated count
        const count = await Cart.getCount(customerId);
        req.session.cartCount = count;

        // For standard form submissions, redirect to cart
        if (!req.xhr && (!req.headers.accept || !req.headers.accept.includes('application/json'))) {
            return res.redirect('/customer/cart');
        }

        res.json({
            success: true,
            message: 'Product added to cart',
            cartCount: count
        });
    } catch (error) {
        console.error('Add to cart error:', error);
        if (!req.xhr && (!req.headers.accept || !req.headers.accept.includes('application/json'))) {
            return res.redirect('back');
        }
        res.status(500).json({ success: false, message: 'Failed to add to cart' });
    }
};

exports.getCartPage = async (req, res) => {
    try {
        const customerId = req.user.id;
        const cartItems = await Cart.getItems(customerId);

        // Calculate grand totals
        let subtotal = 0;
        cartItems.forEach(store => {
            subtotal += store.subtotal;
        });

        const deliveryFee = subtotal > 0 ? 150 : 0; // Flat fee for demo
        const platformFee = subtotal > 0 ? 50 : 0;
        const total = subtotal + deliveryFee + platformFee;

        res.render('customer/cart', {
            title: 'My Cart',
            cartItems,
            totals: {
                subtotal,
                deliveryFee,
                platformFee,
                total
            }
        });
    } catch (error) {
        console.error('Get cart page error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.updateQuantity = async (req, res) => {
    try {
        const { cartId, quantity } = req.body;
        if (quantity < 1) {
            await Cart.removeItem(cartId);
        } else {
            await Cart.updateQuantity(cartId, quantity);
        }

        const count = await Cart.getCount(req.user.id);
        req.session.cartCount = count;

        res.json({ success: true, cartCount: count });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Update failed' });
    }
};

exports.removeFromCart = async (req, res) => {
    try {
        await Cart.removeItem(req.params.id);
        const count = await Cart.getCount(req.user.id);
        req.session.cartCount = count;
        res.json({ success: true, cartCount: count });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Removal failed' });
    }
};
const Order = require('../models/Order.model');
const Address = require('../models/Address.model');

exports.getCheckoutPage = async (req, res) => {
    try {
        const customerId = req.user.id;
        const cartItems = await Cart.getItems(customerId);

        if (cartItems.length === 0) {
            return res.redirect('/customer/cart');
        }

        const addresses = await Address.findByUserId(customerId);

        let subtotal = 0;
        cartItems.forEach(store => {
            subtotal += store.subtotal;
        });

        // Use the same logic as cart page for consistency, or adjust as needed
        const deliveryFee = subtotal > 2500 ? 0 : 150;
        const platformFee = 50;
        const total = subtotal + deliveryFee + platformFee;

        res.render('customer/checkout', {
            title: 'Checkout',
            user: req.user,
            cartItems,
            addresses,
            totals: {
                subtotal,
                deliveryFee,
                platformFee,
                total
            }
        });
    } catch (error) {
        console.error('Checkout page error:', error);
        res.status(500).render('errors/500', { error: error.message });
    }
};

exports.checkout = async (req, res) => {
    try {
        const { paymentMethod, deliveryAddress, notes, latitude, longitude } = req.body;
        const customerId = req.user.id;

        const cartItems = await Cart.getItems(customerId);
        if (cartItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty' });
        }

        const orderIds = [];

        // Create an order for each store in the cart
        for (const store of cartItems) {
            const subtotal = store.subtotal;
            const deliveryFee = subtotal > 2500 ? 0 : 150;
            const serviceFee = 50;
            const total = subtotal + deliveryFee + serviceFee;

            // Map payment method to DB ENUM
            let dbPaymentMethod = 'mobile_money';
            if (paymentMethod === 'card') dbPaymentMethod = 'card';
            if (paymentMethod === 'cod') dbPaymentMethod = 'cash';
            if (paymentMethod === 'wallet') dbPaymentMethod = 'wallet';

            const orderData = {
                customer_id: customerId,
                store_id: store.store_id,
                subtotal,
                delivery_fee: deliveryFee,
                service_fee: serviceFee,
                total_amount: total,
                payment_method: dbPaymentMethod,
                delivery_address: deliveryAddress || req.user.address || 'Address not provided',
                delivery_latitude: latitude || -1.2921, // Default to Nairobi
                delivery_longitude: longitude || 36.8219,
                items: store.items.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.discounted_price || item.price,
                    total_price: item.item_total,
                    special_instructions: item.special_instructions
                }))
            };

            const orderId = await Order.create(orderData);
            orderIds.push(orderId);
        }

        // Reset cart count in session
        req.session.cartCount = 0;

        res.json({
            success: true,
            message: 'Orders placed successfully!',
            orderIds
        });
    } catch (error) {
        console.error('Checkout process error:', error);
        res.status(500).json({ success: false, message: 'Failed to process checkout: ' + error.message });
    }
};
