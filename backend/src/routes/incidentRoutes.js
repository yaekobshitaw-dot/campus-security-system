const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const incidentController = require('../controllers/incidentController');
const { uploadIncidentPhotos } = require('../middleware/incidentUpload');

router.use(authenticate);
router.post('/sos', authorize('student', 'faculty', 'staff', 'security', 'admin'), incidentController.createSOS);
router.post('/', authorize('student', 'faculty', 'staff', 'security', 'admin'), uploadIncidentPhotos.array('photos', 5), incidentController.create);
router.get('/', authorize('student', 'faculty', 'staff', 'security', 'admin'), incidentController.getAll);
router.get('/:incident_id/evidence/:filename', authorize('student', 'faculty', 'staff', 'security', 'admin'), incidentController.serveEvidence);
router.get('/stats', authorize('security', 'admin'), incidentController.getStats);
router.delete('/history', authorize('admin'), incidentController.clearHistory);
router.patch('/:incident_id/status', authorize('security', 'admin'), incidentController.updateStatus);
router.post('/:incident_id/assign', authorize('security', 'admin'), incidentController.assignIncident);
router.patch('/:incident_id/response', authorize('security', 'admin'), incidentController.updateResponseStatus);

module.exports = router;
