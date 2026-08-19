const { Incident } = require('../models');

const SUPPORTED_STATUSES = ['reported', 'investigating', 'resolved'];

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
    const isPrivileged = ['security', 'admin'].includes(req.user.role);
    const where = isPrivileged ? {} : { user_id: req.user.user_id };

    const incidents = await Incident.findAll({
      where,
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({ success: true, data: incidents });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch incidents' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const total = await Incident.count();
    const active = await Incident.count({ where: { status: ['reported', 'investigating'] } });
    const resolved = await Incident.count({ where: { status: 'resolved' } });
    res.status(200).json({ success: true, data: { total, active, resolved } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { incident_id } = req.params;
    const { status } = req.body;

    if (!SUPPORTED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${SUPPORTED_STATUSES.join(', ')}`
      });
    }

    const incident = await Incident.findByPk(incident_id);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    await incident.update({ status });

    return res.status(200).json({
      success: true,
      message: 'Incident status updated successfully',
      data: incident
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update incident status' });
  }
};
