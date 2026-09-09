const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const zoneController = require('../controllers/zoneController');

router.use(authenticate);

router.get('/', zoneController.getZones);
router.get('/:id', zoneController.getZoneById);
router.post('/', authorize('admin', 'security'), zoneController.createZone);
router.put('/:id', authorize('admin', 'security'), zoneController.updateZone);
router.patch('/:id', authorize('admin', 'security'), zoneController.patchZone);
router.delete('/:id', authorize('admin', 'security'), zoneController.deleteZone);

module.exports = router;
