const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getAnalytics } = require('../controllers/analyticsController');

router.get('/', authenticate, authorize('security', 'admin'), getAnalytics);

module.exports = router;
