const { Alert, Incident, Response, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const { processIncidentPhotos } = require('../services/uploadService');
const { sendPushNotification } = require('../services/notificationService');
const { sendSmsMessage } = require('../services/smsService');
const {
  canAccessIncidentEvidence,
  evidenceExists,
  getProtectedEvidenceUrl,
  isStoredEvidence,
  resolveEvidencePath
} = require('../services/evidenceService');

const SUPPORTED_STATUSES = ['reported', 'investigating', 'resolved', 'dispatched', 'on_scene', 'closed'];
const RESPONSE_STATUSES = ['responding', 'resolved', 'closed'];
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const recentSOSRequests = new Map();
const asBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';
const isValidCoordinate = (value, minimum, maximum) => {
  if (value === null || value === undefined || value === '') return true;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum;
};
const toCoordinate = (value) => value === null || value === undefined || value === '' ? null : Number(value);
const normalizePhotos = (photos) => {
  if (Array.isArray(photos)) return photos.filter((photo) => typeof photo === 'string');
  if (typeof photos !== 'string' || !photos.trim()) return [];
  try {
    const parsed = JSON.parse(photos);
    return Array.isArray(parsed) ? parsed.filter((photo) => typeof photo === 'string') : [];
  } catch (error) {
    return [];
  }
};
const haversineDistanceMeters = (latitude1, longitude1, latitude2, longitude2) => {
  const earthRadiusMeters = 6371000;
  const radians = (degrees) => degrees * Math.PI / 180;
  const deltaLatitude = radians(latitude2 - latitude1);
  const deltaLongitude = radians(longitude2 - longitude1);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2)) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const findNearestAvailableOfficer = async (latitude, longitude) => {
  const incidentLatitude = toCoordinate(latitude);
  const incidentLongitude = toCoordinate(longitude);
  if (incidentLatitude === null || incidentLongitude === null) return null;

  const officers = await User.findAll({
    where: {
      role: 'security',
      is_active: true,
      availability_status: 'available'
    },
    attributes: ['user_id', 'name', 'role', 'latitude', 'longitude', 'availability_status']
  });

  return officers
    .map((officer) => ({
      officer,
      distanceMeters: officer.latitude !== null && officer.longitude !== null
        ? haversineDistanceMeters(
          incidentLatitude,
          incidentLongitude,
          Number(officer.latitude),
          Number(officer.longitude)
        )
        : null
    }))
    .sort((left, right) => {
      if (left.distanceMeters === null) return 1;
      if (right.distanceMeters === null) return -1;
      return left.distanceMeters - right.distanceMeters;
    })[0] || null;
};

const emitProtected = (io, event, payload) => {
  if (io) io.to('role:security').to('role:admin').emit(event, payload);
};
const emitIncidentEvent = (io, incident, event, payload) => {
  if (!io) return;
  const recipients = io.to('role:security').to('role:admin');
  if (incident?.user_id) recipients.to(`user:${incident.user_id}`);
  recipients.emit(event, payload);
};
const emitToIncidentOwner = (io, incident, event, payload) => {
  if (io && incident?.user_id) io.to(`user:${incident.user_id}`).emit(event, payload);
};

exports.clearHistory = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const deletedCount = await Incident.destroy({ where: {}, transaction });
    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: 'Incident history cleared successfully',
      data: { deleted_count: deletedCount }
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ success: false, message: 'Failed to clear incident history' });
  }
};

const notifySecurityBySms = async (senderUserId, recipients, message) => {
  if (!senderUserId || !Array.isArray(recipients) || !recipients.length) {
    return [];
  }

  const results = [];
  for (const recipient of recipients) {
    if (!recipient || !recipient.is_active || !recipient.phone) {
      continue;
    }

    try {
      const result = await sendSmsMessage({
        senderUserId,
        recipientUserId: recipient.user_id,
        recipientPhone: recipient.phone,
        message,
      });
      results.push({ user_id: recipient.user_id, status: result.status, sms_id: result.sms_id });
    } catch (error) {
      results.push({ user_id: recipient.user_id, status: 'failed', error: error.message || 'SMS delivery failed.' });
    }
  }

  return results;
};

const assignIncidentToOfficer = async (incident, officer, assignedBy) => {
  const response = await Response.create({
    incident_id: incident.incident_id,
    responder_id: officer.user_id,
    assigned_by: assignedBy || null,
    status: 'assigned'
  });
  await incident.update({ status: 'dispatched' });
  await officer.update({ availability_status: 'responding' });
  return response;
};

const assignmentPayload = (incident, officer, distanceMeters, assignedBy) => ({
  incident_id: incident.incident_id,
  responder: { user_id: officer.user_id, name: officer.name, role: officer.role },
  assigned_by: assignedBy || null,
  distance_meters: Number.isFinite(distanceMeters) ? Math.round(distanceMeters) : null,
  status: incident.status,
  location_name: incident.location_name,
  latitude: incident.latitude,
  longitude: incident.longitude,
  created_at: incident.created_at
});

exports.createSOS = async (req, res) => {
  const userId = req.user.user_id;
  const now = Date.now();
  const previousRequest = recentSOSRequests.get(userId);

  if (previousRequest && now - previousRequest < 30 * 1000) {
    return res.status(429).json({ success: false, message: 'Please wait before sending another SOS alert' });
  }
  recentSOSRequests.set(userId, now);

  const { latitude = null, longitude = null } = req.body || {};
  if (!isValidCoordinate(latitude, -90, 90) || !isValidCoordinate(longitude, -180, 180)) {
    return res.status(400).json({ success: false, message: 'Invalid latitude or longitude' });
  }

  try {
    const incident = await Incident.create({
      user_id: userId,
      type: 'security_threat',
      description: 'SOS emergency alert sent from the Campus Security mobile app.',
      severity: 'critical',
      status: 'reported',
      location_name: latitude !== null && longitude !== null ? 'Current device location' : '',
      latitude,
      longitude,
      is_sos: true,
      is_anonymous: false,
      photos: []
    });
    const nearestOfficer = await findNearestAvailableOfficer(latitude, longitude);
    let assignment = null;
    if (nearestOfficer) {
      const response = await assignIncidentToOfficer(incident, nearestOfficer.officer, null);
      assignment = assignmentPayload(incident, nearestOfficer.officer, nearestOfficer.distanceMeters, null);
      assignment.response_id = response.response_id;
    }
    const alert = await Alert.create({
      incident_id: incident.incident_id,
      type: 'sos_alert',
      title: 'SOS emergency reported',
      message: 'A critical SOS emergency alert was reported.',
      channel: 'dashboard',
      sent_at: new Date()
    });

    const reporter = { user_id: req.user.user_id, name: req.user.name, role: req.user.role };
    const sosPayload = {
      incident_id: incident.incident_id,
      type: incident.type,
      severity: incident.severity,
      status: incident.status,
      is_sos: true,
      location_name: incident.location_name,
      latitude: incident.latitude,
      longitude: incident.longitude,
      created_at: incident.created_at,
      reporter
    };
    const io = req.app.get('io');
    if (io) {
      io.to('role:security').to('role:admin').emit('sos_alert', sosPayload);
      io.to('role:security').to('role:admin').emit('alert-received', alert.toJSON());
      if (assignment) emitProtected(io, 'incident_assigned', assignment);
      if (assignment) emitProtected(io, 'officer_assignment', assignment);
    }

    const recipients = await User.findAll({ where: { is_active: true, role: ['security', 'admin'] } });
    await sendPushNotification(recipients, {
      title: 'SOS emergency reported',
      body: 'A critical SOS emergency alert was reported.',
      data: { incident_id: incident.incident_id, is_sos: true }
    });
    await notifySecurityBySms(req.user.user_id, recipients, `SOS ALERT: A critical security emergency was reported at ${incident.location_name || 'campus'} for incident #${incident.incident_id}.`);

    return res.status(201).json({
      success: true,
      message: 'SOS Alert Sent',
      data: { ...incident.toJSON(), assignment }
    });
  } catch (error) {
    recentSOSRequests.delete(userId);
    return res.status(500).json({ success: false, message: 'Failed to send SOS alert' });
  }
};

exports.assignIncident = async (req, res) => {
  const { incident_id: incidentId } = req.params;
  const { officer_id: officerId } = req.body || {};
  if (!officerId) return res.status(400).json({ success: false, message: 'officer_id is required' });
  if (!isUuid(incidentId) || !isUuid(officerId)) {
    return res.status(400).json({ success: false, message: 'incident_id and officer_id must be valid UUIDs' });
  }

  try {
    const incident = await Incident.findByPk(incidentId);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    const existingResponse = await Response.findOne({ where: { incident_id: incidentId } });
    if (existingResponse) return res.status(409).json({ success: false, message: 'Incident is already assigned' });

    const officer = await User.findOne({
      where: { user_id: officerId, role: 'security', is_active: true },
      attributes: ['user_id', 'name', 'role', 'latitude', 'longitude', 'availability_status']
    });
    if (!officer) return res.status(404).json({ success: false, message: 'Security officer not found' });
    if (officer.availability_status !== 'available') {
      return res.status(409).json({ success: false, message: 'Security officer is not available' });
    }
    const distanceMeters = isValidCoordinate(incident.latitude, -90, 90)
      && isValidCoordinate(incident.longitude, -180, 180)
      && isValidCoordinate(officer.latitude, -90, 90)
      && isValidCoordinate(officer.longitude, -180, 180)
      && incident.latitude !== null && incident.longitude !== null
      && officer.latitude !== null && officer.longitude !== null
      ? haversineDistanceMeters(Number(incident.latitude), Number(incident.longitude), Number(officer.latitude), Number(officer.longitude))
      : null;
    const response = await assignIncidentToOfficer(incident, officer, req.user.user_id);
    const payload = assignmentPayload(incident, officer, distanceMeters || 0, req.user.user_id);
    payload.response_id = response.response_id;
    const updatedIncident = {
      ...incident.toJSON(),
      responses: [{
        ...response.toJSON(),
        responder: { user_id: officer.user_id, name: officer.name, role: officer.role }
      }]
    };
    const ownerAlert = incident.user_id ? await Alert.create({
      incident_id: incident.incident_id,
      type: 'incident_assigned',
      title: 'Security officer assigned',
      message: `${officer.name} has been assigned to your incident.`,
      channel: 'mobile',
      sent_at: new Date()
    }) : null;
    const owner = incident.user_id
      ? await User.findOne({ where: { user_id: incident.user_id, is_active: true } })
      : null;
    emitProtected(req.app.get('io'), 'incident_assigned', payload);
    emitProtected(req.app.get('io'), 'officer_assignment', payload);
    emitToIncidentOwner(req.app.get('io'), incident, 'incident-updated', updatedIncident);
    if (ownerAlert) emitToIncidentOwner(req.app.get('io'), incident, 'alert-received', ownerAlert.toJSON());
    if (owner) {
      await sendPushNotification([owner], {
        title: 'Security officer assigned',
        body: `${officer.name} has been assigned to your incident.`,
        data: { incident_id: incident.incident_id, status: incident.status, officer_id: officer.user_id }
      });
    }
    return res.status(201).json({ success: true, message: 'Incident assigned successfully', data: updatedIncident, assignment: payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to assign incident' });
  }
};

exports.updateResponseStatus = async (req, res) => {
  const { incident_id: incidentId } = req.params;
  const { status } = req.body || {};
  if (!RESPONSE_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: `Response status must be one of: ${RESPONSE_STATUSES.join(', ')}` });
  }

  try {
    const incident = await Incident.findByPk(incidentId);
    const response = await Response.findOne({ where: { incident_id: incidentId } });
    if (!incident || !response) return res.status(404).json({ success: false, message: 'Assigned incident not found' });
    if (req.user.role === 'security' && response.responder_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'Only the assigned officer can update this response' });
    }

    const incidentStatus = status === 'responding' ? 'on_scene' : status;
    await response.update({ status });
    await incident.update({ status: incidentStatus });
    if (status === 'resolved' || status === 'closed') {
      await User.update({ availability_status: 'available' }, { where: { user_id: response.responder_id } });
    }
    const payload = { incident_id: incidentId, response_id: response.response_id, status, incident_status: incidentStatus };
    const updatedIncident = { ...incident.toJSON(), ...payload };
    const ownerAlert = incident.user_id ? await Alert.create({
      incident_id: incident.incident_id,
      type: incidentStatus === 'resolved' ? 'incident_resolved' : 'incident_updated',
      title: 'Incident status updated',
      message: `Your ${incident.type} incident is now ${incidentStatus}.`,
      channel: 'mobile',
      sent_at: new Date()
    }) : null;
    const owner = incident.user_id
      ? await User.findOne({ where: { user_id: incident.user_id, is_active: true } })
      : null;
    emitProtected(req.app.get('io'), 'incident-updated', updatedIncident);
    emitProtected(req.app.get('io'), 'officer_assignment', payload);
    emitToIncidentOwner(req.app.get('io'), incident, 'incident-updated', updatedIncident);
    if (ownerAlert) emitToIncidentOwner(req.app.get('io'), incident, 'alert-received', ownerAlert.toJSON());
    if (owner) {
      await sendPushNotification([owner], {
        title: 'Incident status updated',
        body: `Your ${incident.type} incident is now ${incidentStatus}.`,
        data: { incident_id: incident.incident_id, status: incidentStatus }
      });
    }
    return res.status(200).json({ success: true, message: 'Response status updated successfully', data: payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update response status' });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      type,
      description,
      severity,
      location_name,
      building,
      room,
      floor,
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
      floor: floor || '',
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
      emitIncidentEvent(io, incident, 'new-incident', incident.toJSON());
      emitIncidentEvent(io, incident, 'alert-received', alert.toJSON());
    }

    const recipients = await User.findAll({ where: { is_active: true, role: ['security', 'admin'] } });
    await sendPushNotification(recipients, {
      title: incident.is_sos ? 'SOS emergency reported' : 'New campus incident',
      body: `${incident.type} incident reported${incident.location_name ? ` at ${incident.location_name}` : ''}`,
      data: { incident_id: incident.incident_id, is_sos: incident.is_sos }
    });
    await notifySecurityBySms(req.user.user_id, recipients, `${incident.is_sos ? 'SOS ALERT' : 'INCIDENT ALERT'}: ${incident.type} reported${incident.location_name ? ` at ${incident.location_name}` : ''}.`);

    res.status(201).json({
      success: true,
      message: 'Incident reported successfully',
      data: {
        ...incident.toJSON(),
        photos: normalizePhotos(incident.photos)
          .map((photo) => getProtectedEvidenceUrl(incident.incident_id, photo))
          .filter(Boolean)
      }
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
      include: [{
        model: Response,
        as: 'responses',
        include: [{
          model: User,
          as: 'responder',
          attributes: ['user_id', 'name', 'role', 'latitude', 'longitude', 'availability_status']
        }]
      }, {
        model: User,
        as: 'reporter',
        attributes: ['user_id', 'name', 'role']
      }],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: incidents.map((incident) => ({
        ...incident.toJSON(),
        photos: normalizePhotos(incident.photos)
          .map((photo) => getProtectedEvidenceUrl(incident.incident_id, photo))
          .filter(Boolean)
      }))
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch incidents' });
  }
};

exports.serveEvidence = async (req, res) => {
  try {
    const incident = await Incident.findByPk(req.params.incident_id);
    const filename = req.params.filename;
    if (!incident || !canAccessIncidentEvidence(req.user, incident) || !isStoredEvidence(incident, filename)) {
      return res.status(404).json({ success: false, message: 'Evidence not found' });
    }

    const evidencePath = resolveEvidencePath(filename);
    if (!evidencePath || !evidenceExists(evidencePath)) {
      return res.status(404).json({ success: false, message: 'Evidence not found' });
    }

    return res.sendFile(evidencePath);
  } catch (error) {
    return res.status(404).json({ success: false, message: 'Evidence not found' });
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
    const assignedResponse = await Response.findOne({ where: { incident_id } });
    if (assignedResponse) {
      const responseStatus = status === 'on_scene' ? 'responding' : status === 'dispatched' ? 'assigned' : status;
      if (['assigned', 'responding', 'resolved', 'closed'].includes(responseStatus)) {
        await assignedResponse.update({ status: responseStatus });
      }
      if (status === 'resolved' || status === 'closed') {
        await User.update({ availability_status: 'available' }, { where: { user_id: assignedResponse.responder_id } });
      }
    }

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
      emitProtected(io, 'incident-updated', incident.toJSON());
      emitProtected(io, 'alert-received', alert.toJSON());
      emitToIncidentOwner(io, incident, 'incident-updated', incident.toJSON());
      emitToIncidentOwner(io, incident, 'alert-received', alert.toJSON());
    }

    const recipients = incident.user_id
      ? await User.findAll({ where: { user_id: incident.user_id, is_active: true } })
      : [];
    await sendPushNotification(recipients, {
      title: 'Incident status updated',
      body: `${incident.type} incident is now ${status}`,
      data: { incident_id: incident.incident_id, status }
    });
    await notifySecurityBySms(req.user.user_id, recipients, `INCIDENT UPDATE: ${incident.type} is now ${status}.`);

    return res.status(200).json({
      success: true,
      message: 'Incident status updated successfully',
      data: incident
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update incident status' });
  }
};
