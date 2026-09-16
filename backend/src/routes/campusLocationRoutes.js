const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const controller = require('../controllers/campusLocationController');

const router = express.Router();
router.use(authenticate);
router.get('/', authorize('student', 'faculty', 'staff', 'security', 'admin'), controller.getLocations);
router.get('/:id', authorize('student', 'faculty', 'staff', 'security', 'admin'), controller.getLocationById);
router.post('/', authorize('admin'), controller.createLocation);
router.put('/:id', authorize('admin'), controller.updateLocation);
router.patch('/:id', authorize('admin'), controller.patchLocation);
router.delete('/:id', authorize('admin'), controller.deleteLocation);

module.exports = router;