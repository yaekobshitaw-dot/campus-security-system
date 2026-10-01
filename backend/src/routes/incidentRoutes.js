const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const incidentController = require('../controllers/incidentController');
const { uploadIncidentPhotos } = require('../middleware/incidentUpload');

router.use(authenticate);
router.post('/sos', authorize('student', 'faculty', 'staff'), incidentController.createSOS);
router.post('/', authorize('student', 'faculty', 'staff'), uploadIncidentPhotos.array('photos', 5), incidentController.create);
router.get('/', authorize('student', 'faculty', 'staff', 'security', 'security_officer', 'admin'), incidentController.getAll);
router.get('/history', authorize('student', 'faculty', 'staff', 'security', 'security_officer', 'admin'), incidentController.getHistory);
router.delete('/history', authorize('student', 'faculty', 'staff', 'security', 'security_officer', 'admin'), incidentController.clearHistory);
router.get('/responses/pending', authorize('security', 'security_officer', 'admin'), incidentController.getPendingAssignments);
router.post('/responses/:response_id/accept', authorize('security', 'security_officer', 'admin'), incidentController.acceptAssignment);
router.post('/responses/:response_id/decline', authorize('security', 'security_officer', 'admin'), incidentController.declineAssignment);
router.get('/:incident_id/evidence/:filename', authorize('student', 'faculty', 'staff', 'security', 'security_officer', 'admin'), incidentController.serveEvidence);
router.get('/stats', authorize('security', 'security_officer', 'admin'), incidentController.getStats);
router.patch('/:incident_id/status', authorize('admin'), incidentController.updateStatus);
router.post('/:incident_id/assign', authorize('admin'), incidentController.assignIncident);
router.patch('/:incident_id/response', authorize('security', 'security_officer', 'admin'), incidentController.updateResponseStatus);

module.exports = router;
