const express = require('express');
const router = express.Router();
const { authenticate, authenticateEmergency, authorize } = require('../middleware/auth');
const incidentController = require('../controllers/incidentController');
const { uploadIncidentPhotos } = require('../middleware/incidentUpload');

router.post('/sos', authenticateEmergency, authorize('student', 'faculty', 'staff'), incidentController.createSOS);
router.post('/', authenticateEmergency, authorize('student', 'faculty', 'staff'), uploadIncidentPhotos.array('photos', 5), incidentController.create);
router.get('/responses/pending', authenticateEmergency, authorize('security', 'security_officer', 'admin'), incidentController.getPendingAssignments);
router.post('/responses/:response_id/accept', authenticateEmergency, authorize('security', 'security_officer', 'admin'), incidentController.acceptAssignment);
router.post('/responses/:response_id/decline', authenticateEmergency, authorize('security', 'security_officer', 'admin'), incidentController.declineAssignment);
router.patch('/:incident_id/response', authenticateEmergency, authorize('security', 'security_officer', 'admin'), incidentController.updateResponseStatus);
router.get('/:incident_id/evidence/:filename', authenticateEmergency, authorize('student', 'faculty', 'staff', 'security', 'security_officer', 'admin'), incidentController.serveEvidence);

router.use(authenticate);
router.get('/', authorize('student', 'faculty', 'staff', 'security', 'security_officer', 'admin'), incidentController.getAll);
router.get('/history', authorize('student', 'faculty', 'staff', 'security', 'security_officer', 'admin'), incidentController.getHistory);
router.delete('/history', authorize('student', 'faculty', 'staff', 'security', 'security_officer', 'admin'), incidentController.clearHistory);
router.get('/stats', authorize('security', 'security_officer', 'admin'), incidentController.getStats);
router.patch('/:incident_id/status', authorize('admin'), incidentController.updateStatus);
router.post('/:incident_id/assign', authorize('admin'), incidentController.assignIncident);

module.exports = router;