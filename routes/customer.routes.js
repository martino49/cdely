const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const cartController = require('../controllers/cart.controller');
const { isCustomer } = require('../middleware/role.middleware');
const { isAuthenticated, loadUser } = require('../middleware/auth.middleware');

router.get('/dashboard', isAuthenticated, isCustomer, customerController.getDashboard);
router.get('/stores', loadUser, customerController.browseStores);
router.get('/store/:id', loadUser, customerController.getStore);
router.get('/product/:id', loadUser, customerController.getProduct);

// Cart Routes
router.get('/cart', isAuthenticated, isCustomer, cartController.getCartPage);
router.post('/add-to-cart', isAuthenticated, isCustomer, cartController.addToCart);
router.post('/cart/update', isAuthenticated, isCustomer, cartController.updateQuantity);
router.delete('/cart/item/:id', isAuthenticated, isCustomer, cartController.removeFromCart);

router.get('/checkout-page', isAuthenticated, isCustomer, cartController.getCheckoutPage);
router.post('/checkout', isAuthenticated, isCustomer, cartController.checkout);

router.get('/orders', isAuthenticated, isCustomer, customerController.getOrders);
router.get('/order/:id', isAuthenticated, isCustomer, customerController.getOrderDetails);
router.get('/track/:orderId', isAuthenticated, isCustomer, customerController.trackOrder);

router.get('/profile', isAuthenticated, isCustomer, customerController.getProfile);
router.post('/profile', isAuthenticated, isCustomer, customerController.updateProfile);
router.get('/wallet', isAuthenticated, isCustomer, customerController.getWallet);
router.post('/wallet/topup', isAuthenticated, isCustomer, customerController.topUpWallet);

// Review Routes
router.post('/review', isAuthenticated, isCustomer, customerController.submitReview);

// Favorite Routes
router.get('/favorites', isAuthenticated, isCustomer, customerController.getFavorites);
router.post('/favorites/toggle', isAuthenticated, isCustomer, customerController.toggleFavorite);

// Address Routes
router.get('/addresses', isAuthenticated, isCustomer, customerController.getAddresses);
router.post('/addresses', isAuthenticated, isCustomer, customerController.addAddress);
router.delete('/addresses/:id', isAuthenticated, isCustomer, customerController.deleteAddress);
router.post('/addresses/:id/default', isAuthenticated, isCustomer, customerController.setDefaultAddress);

module.exports = router;
