const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { Alert, Incident, Response } = require('../models');

router.use(authenticate);

const assignedIncidentIdsFor = async (user) => (await Response.findAll({
  where: { responder_id: user.user_id },
  attributes: ['incident_id']
})).map((response) => response.incident_id);

router.get('/', async (req, res) => {
  try {
    const role = String(req.user.role || '').trim().toLowerCase();
    const isPrivileged = ['security', 'security_officer', 'admin'].includes(role);
    const assignedIncidentIds = ['security', 'security_officer'].includes(role)
      ? await assignedIncidentIdsFor(req.user)
      : null;
    const alerts = await Alert.findAll({
      ...(['security', 'security_officer'].includes(role) ? {
        where: { incident_id: { [Op.in]: assignedIncidentIds } }
      } : {}),
      include: [{
        model: Incident,
        as: 'incident',
        ...(isPrivileged ? {} : { where: { user_id: req.user.user_id }, required: true })
      }],
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
    const role = String(req.user.role || '').trim().toLowerCase();
    const isPrivileged = ['security', 'security_officer', 'admin'].includes(role);
    const assignedIncidentIds = ['security', 'security_officer'].includes(role)
      ? await assignedIncidentIdsFor(req.user)
      : null;
    const alert = await Alert.findOne({
      where: {
        alert_id: req.params.id,
        ...(['security', 'security_officer'].includes(role) ? { incident_id: { [Op.in]: assignedIncidentIds } } : {})
      },
      include: [{
        model: Incident,
        as: 'incident',
        ...(isPrivileged ? {} : { where: { user_id: req.user.user_id }, required: true })
      }]
    });
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    await alert.update({ is_read: true });
    return res.json({ success: true, data: alert });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to update alert' });
  }
});

module.exports = router;
