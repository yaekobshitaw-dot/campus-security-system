const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
	broadcastSms,
	createSmsRequest,
	getAdminSmsRecipients,
	getPendingSmsForUser,
	getSmsHistory,
	updateSmsStatusByRecipient,
} = require('../controllers/smsController');

router.use(authenticate);
router.get('/pending', getPendingSmsForUser);
router.get('/recipients', authorize('admin'), getAdminSmsRecipients);
router.get('/history', authorize('admin'), getSmsHistory);
router.post('/broadcast', authorize('admin'), broadcastSms);
router.post('/send', authorize('admin'), createSmsRequest);
router.patch('/:smsId/result', updateSmsStatusByRecipient);

module.exports = router;
