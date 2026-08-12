const { Incident } = require('../models');

exports.create = async (req, res) => {
  try {
    const { type, description, severity, location_name, building, room, is_anonymous } = req.body;
    if (!type) {
      return res.status(400).json({ success: false, message: 'Incident type is required' });
    }
    const incident = await Incident.create({
      user_id: is_anonymous ? null : req.user.user_id,
      type,
      description: description || '',
      severity: severity || 'medium',
      location_name: location_name || '',
      building: building || '',
      room: room || '',
      is_anonymous: is_anonymous || false,
      status: 'reported'
    });
    res.status(201).json({
      success: true,
      message: 'Incident reported successfully',
      data: incident
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to report incident' });
  }
};

exports.getAll = async (req, res) => {
  try {
    const incidents = await Incident.findAll({ order: [['created_at', 'DESC']] });
    res.status(200).json({ success: true, data: incidents });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch incidents' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const total = await Incident.count();
    const active = await Incident.count({ where: { status: ['reported', 'acknowledged', 'dispatched', 'on_scene'] } });
    const resolved = await Incident.count({ where: { status: ['resolved', 'closed'] } });
    res.status(200).json({ success: true, data: { total, active, resolved } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
};
