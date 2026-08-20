const { Alert, Incident, User } = require('../models');
const { processIncidentPhotos } = require('../services/uploadService');
const { sendPushNotification } = require('../services/notificationService');

const SUPPORTED_STATUSES = ['reported', 'investigating', 'resolved'];
const asBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';

exports.create = async (req, res) => {
  try {
    const {
      type,
      description,
      severity,
      location_name,
      building,
      room,
      latitude,
      longitude,
      is_anonymous,
      is_sos
    } = req.body;
    if (!type) {
      return res.status(400).json({ success: false, message: 'Incident type is required' });
    }
    let photoReferences = [];
    try {
      photoReferences = Array.isArray(req.body.photos)
        ? req.body.photos
        : typeof req.body.photos === 'string'
          ? JSON.parse(req.body.photos)
          : [];
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Invalid photos payload' });
    }
    const photos = req.files?.length
      ? (await processIncidentPhotos(req.files, undefined)).map((photo) => `${req.protocol}://${req.get('host')}${photo}`)
      : photoReferences.filter((photo) => typeof photo === 'string');

    const incident = await Incident.create({
      user_id: asBoolean(is_anonymous) ? null : req.user.user_id,
      type,
      description: description || '',
      severity: severity || 'medium',
      location_name: location_name || '',
      building: building || '',
      room: room || '',
      latitude: latitude === '' || latitude == null ? null : latitude,
      longitude: longitude === '' || longitude == null ? null : longitude,
      is_sos: asBoolean(is_sos),
      photos,
      is_anonymous: asBoolean(is_anonymous),
      status: 'reported'
    });

    const alert = await Alert.create({
      incident_id: incident.incident_id,
      type: incident.is_sos ? 'sos_alert' : 'incident_reported',
      title: incident.is_sos ? 'SOS emergency reported' : 'New incident reported',
      message: `${incident.type} incident reported${incident.location_name ? ` at ${incident.location_name}` : ''}`,
      channel: 'dashboard',
      sent_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('new-incident', incident.toJSON());
      io.emit('alert-received', alert.toJSON());
    }

    const recipients = await User.findAll({ where: { is_active: true, role: ['security', 'admin'] } });
    await sendPushNotification(recipients, {
      title: incident.is_sos ? 'SOS emergency reported' : 'New campus incident',
      body: `${incident.type} incident reported${incident.location_name ? ` at ${incident.location_name}` : ''}`,
      data: { incident_id: incident.incident_id, is_sos: incident.is_sos }
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

    const alert = await Alert.create({
      incident_id: incident.incident_id,
      type: status === 'resolved' ? 'incident_resolved' : 'incident_updated',
      title: 'Incident status updated',
      message: `${incident.type} incident is now ${status}`,
      channel: 'dashboard',
      sent_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('incident-updated', incident.toJSON());
      io.emit('alert-received', alert.toJSON());
    }

    const recipients = incident.user_id
      ? await User.findAll({ where: { user_id: incident.user_id, is_active: true } })
      : [];
    await sendPushNotification(recipients, {
      title: 'Incident status updated',
      body: `${incident.type} incident is now ${status}`,
      data: { incident_id: incident.incident_id, status }
    });

    return res.status(200).json({
      success: true,
      message: 'Incident status updated successfully',
      data: incident
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update incident status' });
  }
};
