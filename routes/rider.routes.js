const express = require('express');
const router = express.Router();
const riderController = require('../controllers/rider.controller');

const { isAuthenticated } = require('../middleware/auth.middleware');
const { isRider } = require('../middleware/role.middleware');

router.get('/dashboard', isAuthenticated, isRider, riderController.getDashboard);
router.get('/available-orders', isAuthenticated, isRider, riderController.getAvailableOrders);
router.post('/accept-order', isAuthenticated, isRider, riderController.acceptOrder);
router.get('/active-delivery', isAuthenticated, isRider, riderController.getActiveDelivery);
router.post('/update-status', isAuthenticated, isRider, riderController.updateDeliveryStatus);
router.get('/earnings', isAuthenticated, isRider, riderController.getEarnings);
router.get('/profile', isAuthenticated, isRider, riderController.getProfile);

module.exports = router;
