const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/seller.controller');

const { isAuthenticated } = require('../middleware/auth.middleware');
const { isSeller } = require('../middleware/role.middleware');

router.get('/dashboard', isAuthenticated, isSeller, sellerController.getDashboard);
router.post('/store', isAuthenticated, isSeller, sellerController.createStore);
router.get('/products', isAuthenticated, isSeller, sellerController.getProducts);
router.get('/orders', isAuthenticated, isSeller, sellerController.getOrders);
router.post('/order/update-status', isAuthenticated, isSeller, sellerController.updateOrderStatus);

// Product CRUD
router.post('/products', isAuthenticated, isSeller, sellerController.addProduct);
router.put('/products/:id', isAuthenticated, isSeller, sellerController.updateProduct);
router.delete('/products/:id', isAuthenticated, isSeller, sellerController.deleteProduct);

// Profile & Wallet
router.get('/profile', isAuthenticated, isSeller, sellerController.getProfile);
router.post('/profile', isAuthenticated, isSeller, sellerController.updateProfile);
router.get('/wallet', isAuthenticated, isSeller, sellerController.getWallet);

module.exports = router;
