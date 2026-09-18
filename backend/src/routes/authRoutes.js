const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const oauthService = require('../services/oauthService');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
oauthService.SUPPORTED_PROVIDERS.forEach((provider) => {
	router.get(`/oauth/${provider}/status`, (req, res) => res.status(oauthService.isConfigured(provider) ? 200 : 503).json({
		success: oauthService.isConfigured(provider),
		provider,
		configured: oauthService.isConfigured(provider),
		message: oauthService.isConfigured(provider) ? undefined : `${provider[0].toUpperCase()}${provider.slice(1)} sign-in is not configured.`
	}));
	router.get(`/oauth/${provider}/start`, (req, res) => oauthService.start(req, res, provider));
	router.get(`/oauth/${provider}/callback`, (req, res) => oauthService.callback(req, res, provider, authController.generateToken));
});
router.post('/oauth/exchange', authController.oauthExchange);
router.post('/logout', authenticate, authController.logout);
router.post('/setup-first-admin', authController.setupFirstAdmin);
router.post('/admin/create-user', authenticate, authorize('admin'), authController.createUserByAdmin);

module.exports = router;
