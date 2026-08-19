const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const incidentController = require('../controllers/incidentController');

router.use(authenticate);
router.post('/', authorize('student', 'faculty', 'staff', 'security', 'admin'), incidentController.create);
router.get('/', authorize('student', 'faculty', 'staff', 'security', 'admin'), incidentController.getAll);
router.get('/stats', authorize('security', 'admin'), incidentController.getStats);
router.patch('/:incident_id/status', authorize('security', 'admin'), incidentController.updateStatus);

module.exports = router;
