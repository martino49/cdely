const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

const { isAuthenticated } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/role.middleware');

router.get('/dashboard', isAuthenticated, isAdmin, adminController.getDashboard);
router.get('/users', isAuthenticated, isAdmin, adminController.getUsers);
router.get('/stores', isAuthenticated, isAdmin, adminController.getStores);
router.post('/store/approve', isAuthenticated, isAdmin, adminController.approveStore);
router.delete('/user/:id', isAuthenticated, isAdmin, adminController.deleteUser);

module.exports = router;
