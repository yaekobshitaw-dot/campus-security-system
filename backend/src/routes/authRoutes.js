const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/logout', authenticate, authController.logout);
router.post('/setup-first-admin', authController.setupFirstAdmin);
router.post('/admin/create-user', authenticate, authorize('admin'), authController.createUserByAdmin);

module.exports = router;
