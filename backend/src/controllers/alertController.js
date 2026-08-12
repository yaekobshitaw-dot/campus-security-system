const { Alert, Incident } = require('../models');
const { logger } = require('../utils/logger');

exports.createAlert = async (req, res) => {
  try {
    const { incident_id, type, message } = req.body;
    const alert = await Alert.create({ incident_id, type, message, is_resolved: false });
    res.status(201).json({ success: true, data: alert });
  } catch (error) {
    logger.error('Create alert failed:', error);
    res.status(500).json({ success: false, message: 'Unable to create alert' });
  }
};

exports.getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.findAll({ include: [{ model: Incident, as: 'incident' }] });
    res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error('Get alerts failed:', error);
    res.status(500).json({ success: false, message: 'Unable to load alerts' });
  }
};

exports.getAlertById = async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    res.json({ success: true, data: alert });
  } catch (error) {
    logger.error('Get alert failed:', error);
    res.status(500).json({ success: false, message: 'Unable to load alert' });
  }
};

exports.updateAlertStatus = async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    alert.is_resolved = req.body.is_resolved ?? alert.is_resolved;
    await alert.save();
    res.json({ success: true, data: alert });
  } catch (error) {
    logger.error('Update alert failed:', error);
    res.status(500).json({ success: false, message: 'Unable to update alert' });
  }
};
