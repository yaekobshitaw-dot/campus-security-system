const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { Alert, Incident } = require('../models');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const alerts = await Alert.findAll({
      include: [{ model: Incident, as: 'incident' }],
      order: [['sent_at', 'DESC']]
    });
    return res.json({ success: true, data: alerts });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load alerts' });
  }
});

router.post('/', (req, res) => {
  res.status(501).json({ success: false, message: 'Create alert not implemented.' });
});

router.put('/:id/read', async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    await alert.update({ is_read: true });
    return res.json({ success: true, data: alert });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to update alert' });
  }
});

module.exports = router;
