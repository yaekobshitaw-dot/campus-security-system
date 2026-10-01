const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const zoneController = require('../controllers/zoneController');

router.use(authenticate);

router.get('/', zoneController.getZones);
router.get('/:id', zoneController.getZoneById);
router.post('/', authorize('admin'), zoneController.createZone);
router.put('/:id', authorize('admin'), zoneController.updateZone);
router.patch('/:id', authorize('admin'), zoneController.patchZone);
router.delete('/:id', authorize('admin'), zoneController.deleteZone);

module.exports = router;
