const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { createSmsRequest, getPendingSmsForUser, updateSmsStatusByRecipient } = require('../controllers/smsController');

router.use(authenticate);
router.get('/pending', getPendingSmsForUser);
router.post('/send', authorize('admin'), createSmsRequest);
router.patch('/:smsId/result', updateSmsStatusByRecipient);

module.exports = router;
