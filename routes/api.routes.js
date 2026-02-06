const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');

// API routes implementation
router.get('/track', orderController.apiTrackOrder);
// router.post('/webhook/mpesa', webhookController.mpesa); // Placeholder

module.exports = router;
