const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const incidentController = require('../controllers/incidentController');

router.use(authenticate);
router.post('/', incidentController.create);
router.get('/', incidentController.getAll);
router.get('/stats', incidentController.getStats);

module.exports = router;
