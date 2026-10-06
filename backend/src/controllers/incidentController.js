const { Alert, Incident, IncidentHistoryClear, Response, User, sequelize } = require('../models');
const { attachCampusLocationMatches } = require('../services/campusLocationMatchingService');
const { predictRiskLevel } = require('../services/mlService');
const { haversineDistanceMeters } = require('../utils/geoUtils');
const { Op } = require('sequelize');
const { processIncidentPhotos } = require('../services/uploadService');
const { sendPushNotification } = require('../services/notificationService');
const { sendSmsMessage } = require('../services/smsService');
const { recordAudit } = require('../services/auditService');
const { getActiveAdmins, notifyUsers } = require('../services/notificationPersistence');
const { getSetting } = require('../services/settingsService');
const {
  canAccessIncidentEvidence,
  evidenceExists,
  getProtectedEvidenceUrl,
  isStoredEvidence,
  resolveEvidencePath
} = require('../services/evidenceService');

const SUPPORTED_STATUSES = ['reported', 'investigating', 'resolved', 'dispatched', 'on_scene', 'closed', 'cancelled'];
const RESPONSE_STATUSES = ['responding', 'resolved', 'closed', 'cancelled'];
const ACTIVE_ASSIGNMENT_STATUSES = ['reported', 'investigating', 'dispatched', 'on_scene'];
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const recentSOSRequests = new Map();
const asBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';
const normalizeAvailabilityStatus = (status) => String(status || '').trim().toLowerCase();
const isOfficiallyAvailable = (officer) => normalizeAvailabilityStatus(officer?.availability_status) === 'available';
const hasActiveRespondingAssignment = async (userId, transaction = null) => {
  const response = await Response.findOne({
    where: {
      responder_id: userId,
      status: 'responding'
    },
    transaction: transaction || undefined
  });
  return Boolean(response);
};
const isValidCoordinate = (value, minimum, maximum) => {
  if (value === null || value === undefined || value === '') return true;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum;
};
const isValidAccuracy = (value) => {
  if (value === null || value === undefined || value === '') return true;
  return (typeof value === 'number' || typeof value === 'string')
    && String(value).trim() !== ''
    && Number.isFinite(Number(value))
    && Number(value) >= 0;
};
const isValidLocationTimestamp = (value) => (
  value === null
  || value === undefined
  || value === ''
  || (Number.isFinite(new Date(value).getTime()))
);
const toCoordinate = (value) => value === null || value === undefined || value === '' ? null : Number(value);
const toOptionalNumber = (value) => value === null || value === undefined || value === '' ? null : Number(value);
const toOptionalDate = (value) => value === null || value === undefined || value === '' ? null : new Date(value);
const validateLocationMetadata = ({ latitude, longitude, location_accuracy: accuracy, location_timestamp: timestamp }) => {
  if (!isValidCoordinate(latitude, -90, 90)) return 'Invalid latitude';
  if (!isValidCoordinate(longitude, -180, 180)) return 'Invalid longitude';
  if (!isValidAccuracy(accuracy)) return 'Invalid location accuracy';
  if (!isValidLocationTimestamp(timestamp)) return 'Invalid location timestamp';
  return null;
};
const isSecurityRole = (role) => ['security', 'security_officer'].includes(String(role || '').trim().toLowerCase());
const normalizeRole = (role) => String(role || '').trim().toLowerCase();
const normalizeSecurityRoleList = (role) => isSecurityRole(role) ? ['security', 'security_officer'] : [normalizeRole(role)];
const normalizeSecurityFilter = (role) => ({
  [Op.or]: [{ role: 'security' }, { role: 'security_officer' }]
});
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
const findNearestAvailableOfficer = async (latitude, longitude) => {
  const incidentLatitude = toCoordinate(latitude);
  const incidentLongitude = toCoordinate(longitude);
  if (incidentLatitude === null || incidentLongitude === null) return null;

  const officers = await User.findAll({
    where: {
      is_active: true,
      availability_status: 'available',
      [Op.or]: [{ role: 'security' }, { role: 'security_officer' }]
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

const emitAssignmentEvent = (io, responderId, event, payload) => {
  if (!io) return;
  const recipients = io.to('role:admin');
  if (responderId) recipients.to(`user:${responderId}`);
  recipients.emit(event, payload);
};
const emitIncidentEvent = (io, incident, event, payload) => {
  if (!io) return;
  const recipients = io.to('role:admin');
  if (incident?.user_id) recipients.to(`user:${incident.user_id}`);
  recipients.emit(event, payload);
};
const emitToIncidentOwner = (io, incident, event, payload) => {
  if (io && incident?.user_id) io.to(`user:${incident.user_id}`).emit(event, payload);
};

exports.clearHistory = async (req, res) => {
  const role = normalizeRole(req.user?.role);
  if (role !== 'admin') {
    try {
      await IncidentHistoryClear.upsert({
        user_id: req.user.user_id,
        cleared_at: new Date()
      });
      return res.status(200).json({
        success: true,
        message: 'Your incident history was cleared successfully',
        data: { cleared: true }
      });
    } catch (error) {
      console.error('Unable to clear incident history:', error?.message || error);
      return res.status(500).json({ success: false, message: 'Failed to clear incident history' });
    }
  }

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
    console.error('Unable to clear system incident history:', error?.message || error);
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

const assignIncidentToOfficer = async (incident, officer, assignedBy, transaction = null) => {
  const response = await Response.create({
    incident_id: incident.incident_id,
    responder_id: officer.user_id,
    assigned_by: assignedBy || null,
    status: 'assigned'
  }, transaction ? { transaction } : undefined);
  return response;
};

const assignmentPayload = (incident, officer, distanceMeters, assignedBy, assignmentStatus = 'pending', responseId = null) => ({
  incident_id: incident.incident_id,
  responder: { user_id: officer.user_id, name: officer.name, role: officer.role },
  assigned_by: assignedBy || null,
  distance_meters: Number.isFinite(distanceMeters) ? Math.round(distanceMeters) : null,
  assignment_status: assignmentStatus,
  response_id: responseId || null,
  status: assignmentStatus === 'accepted' ? 'responding' : assignmentStatus === 'declined' ? 'assigned' : 'pending',
  incident_status: incident.status,
  location_name: incident.location_name,
  latitude: incident.latitude,
  longitude: incident.longitude,
  location_accuracy: incident.location_accuracy,
  location_timestamp: incident.location_timestamp,
  created_at: incident.created_at
});

exports.getPendingAssignments = async (req, res) => {
  try {
    const where = isSecurityRole(req.user.role)
      ? { responder_id: req.user.user_id, assignment_status: { [Op.in]: ['pending', 'accepted'] }, status: { [Op.in]: ['assigned', 'responding'] } }
      : { assignment_status: 'pending', status: 'assigned' };

    const pendingAssignments = await Response.findAll({
      where,
      include: [{
        model: Incident,
        as: 'incident',
        include: [{
          model: User,
          as: 'reporter',
          attributes: ['user_id', 'name', 'role']
        }]
      }, {
        model: User,
        as: 'responder',
        attributes: ['user_id', 'name', 'role', 'availability_status']
      }],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: pendingAssignments.map((response) => ({
        ...response.toJSON(),
        incident: response.incident ? response.incident.toJSON() : null,
        responder: response.responder ? response.responder.toJSON() : null
      }))
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load pending assignments' });
  }
};

exports.assignIncident = async (req, res) => {
  const { incident_id: incidentId } = req.params;
  const { officer_id: officerId } = req.body || {};
  if (!officerId) return res.status(400).json({ success: false, message: 'officer_id is required' });
  if (!isUuid(incidentId) || !isUuid(officerId)) {
    return res.status(400).json({ success: false, message: 'incident_id and officer_id must be valid UUIDs' });
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();
    const incident = await Incident.findByPk(incidentId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!incident) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }
    if (!ACTIVE_ASSIGNMENT_STATUSES.includes(incident.status)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Incident is not active' });
    }

    const existingAssignment = await Response.findOne({
      where: {
        incident_id: incidentId,
        assignment_status: { [Op.in]: ['pending', 'accepted'] }
      },
      transaction
    });
    if (existingAssignment) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: 'Incident already has a pending or accepted assignment request'
      });
    }

    const officer = await User.findOne({
      where: {
        user_id: officerId,
        is_active: true,
        role: { [Op.in]: normalizeSecurityRoleList('security') }
      },
      attributes: ['user_id', 'name', 'role', 'latitude', 'longitude', 'availability_status'],
      transaction
    });
    if (!officer) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Security officer not found' });
    }
    if (await hasActiveRespondingAssignment(officer.user_id, transaction)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Security officer is already responding to an incident' });
    }
    if (!isOfficiallyAvailable(officer)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Security officer is not available' });
    }

    const hasCoordinates = isValidCoordinate(incident.latitude, -90, 90)
      && isValidCoordinate(incident.longitude, -180, 180)
      && isValidCoordinate(officer.latitude, -90, 90)
      && isValidCoordinate(officer.longitude, -180, 180)
      && [incident.latitude, incident.longitude, officer.latitude, officer.longitude]
        .every((coordinate) => coordinate !== null && coordinate !== undefined && coordinate !== '');
    const distanceMeters = hasCoordinates
      ? haversineDistanceMeters(
        Number(incident.latitude),
        Number(incident.longitude),
        Number(officer.latitude),
        Number(officer.longitude)
      )
      : null;
    const response = await assignIncidentToOfficer(incident, officer, req.user.user_id, transaction);
    await transaction.commit();

    await recordAudit(req, {
      action: 'officer_assigned',
      resourceType: 'incident',
      resourceId: incidentId,
      details: `Assigned officer ${officer.user_id}.`
    });
    const payload = assignmentPayload(incident, officer, distanceMeters, req.user.user_id, 'pending', response.response_id);
    await notifyUsers(req, {
      type: 'officer_assignment',
      title: 'Security officer assigned',
      message: `${officer.name} has been assigned to an incident.`,
      resourceType: 'incident',
      resourceId: incidentId,
      link: `/incidents/${incidentId}`,
      dedupeKey: `assignment:${incidentId}:${officer.user_id}`
    }, [officer]);

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
    const io = req.app.get('io');
    emitAssignmentEvent(io, officer.user_id, 'incident_assigned', payload);
    emitAssignmentEvent(io, officer.user_id, 'officer_assignment', payload);
    emitAssignmentEvent(io, officer.user_id, 'assignment-requested', payload);
    emitToIncidentOwner(io, incident, 'incident-updated', updatedIncident);
    if (ownerAlert) emitToIncidentOwner(io, incident, 'alert-received', ownerAlert.toJSON());
    if (owner) {
      await sendPushNotification([owner], {
        title: 'Security officer assigned',
        body: `${officer.name} has been assigned to your incident.`,
        data: { incident_id: incident.incident_id, status: incident.status, officer_id: officer.user_id }
      });
    }
    return res.status(201).json({
      success: true,
      message: 'Incident assigned successfully',
      data: updatedIncident,
      assignment: payload
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: 'Failed to assign incident' });
  }
};

exports.acceptAssignment = async (req, res) => {
  const { response_id: responseId } = req.params;
  if (!responseId || !isUuid(responseId)) {
    return res.status(400).json({ success: false, message: 'response_id must be a valid UUID' });
  }

  try {
    const response = await Response.findByPk(responseId, {
      include: [{
        model: Incident,
        as: 'incident'
      }, {
        model: User,
        as: 'responder',
        attributes: ['user_id', 'name', 'role', 'availability_status']
      }]
    });
    if (!response) {
      return res.status(404).json({ success: false, message: 'Assignment request not found' });
    }
    if (isSecurityRole(req.user.role) && response.responder_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'Only the assigned officer can respond to this assignment' });
    }
    if (response.assignment_status !== 'pending') {
      return res.status(409).json({ success: false, message: `Assignment request has already been ${response.assignment_status}` });
    }

    const incident = response.incident;
    await response.update({ assignment_status: 'accepted', status: 'responding' });
    if (incident) {
      // "investigating" is the persisted status displayed as "In Progress".
      await incident.update({ status: 'investigating' });
    }
    await User.update({ availability_status: 'responding' }, { where: { user_id: response.responder_id } });

    const payload = assignmentPayload(
      incident || { incident_id: response.incident_id, status: 'investigating', location_name: '', latitude: null, longitude: null },
      response.responder || { user_id: response.responder_id, name: 'Officer', role: 'security' },
      null,
      null,
      'accepted',
      response.response_id
    );
    const io = req.app.get('io');
    emitAssignmentEvent(io, response.responder_id, 'officer_assignment', payload);
    if (incident) emitToIncidentOwner(io, incident, 'incident-updated', { ...incident.toJSON(), ...payload });
    return res.status(200).json({ success: true, message: 'Assignment accepted successfully', data: payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to accept assignment' });
  }
};

exports.declineAssignment = async (req, res) => {
  const { response_id: responseId } = req.params;
  if (!responseId || !isUuid(responseId)) {
    return res.status(400).json({ success: false, message: 'response_id must be a valid UUID' });
  }

  try {
    const response = await Response.findByPk(responseId, {
      include: [{
        model: Incident,
        as: 'incident'
      }, {
        model: User,
        as: 'responder',
        attributes: ['user_id', 'name', 'role', 'availability_status']
      }]
    });
    if (!response) {
      return res.status(404).json({ success: false, message: 'Assignment request not found' });
    }
    if (isSecurityRole(req.user.role) && response.responder_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'Only the assigned officer can respond to this assignment' });
    }
    if (response.assignment_status !== 'pending') {
      return res.status(409).json({ success: false, message: `Assignment request has already been ${response.assignment_status}` });
    }

    await response.update({ assignment_status: 'declined', status: 'assigned' });
    const incident = response.incident;
    const payload = assignmentPayload(
      incident || { incident_id: response.incident_id, status: 'reported', location_name: '', latitude: null, longitude: null },
      response.responder || { user_id: response.responder_id, name: 'Officer', role: 'security' },
      null,
      null,
      'declined',
      response.response_id
    );
    const io = req.app.get('io');
    emitAssignmentEvent(io, response.responder_id, 'officer_assignment', payload);
    if (incident) emitToIncidentOwner(io, incident, 'incident-updated', { ...incident.toJSON(), ...payload });
    return res.status(200).json({ success: true, message: 'Assignment declined successfully', data: payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to decline assignment' });
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
    const assignments = await Response.findAll({
      where: { incident_id: incidentId },
      order: [['created_at', 'DESC']]
    });
    const securityOfficer = isSecurityRole(req.user.role);
    const response = assignments.find((assignment) => (
      assignment.assignment_status === 'accepted'
      && (!securityOfficer || assignment.responder_id === req.user.user_id)
    )) || assignments.find((assignment) => (
      !securityOfficer || assignment.responder_id === req.user.user_id
    )) || assignments[0];
    if (!incident || !response) return res.status(404).json({ success: false, message: 'Assigned incident not found' });
    if (securityOfficer && response.responder_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'Only the assigned officer can update this response' });
    }

    const incidentStatus = status === 'responding' ? 'on_scene' : status;
    if (status === 'responding' && response.assignment_status !== 'accepted') {
      return res.status(409).json({ success: false, message: 'Assignment must be accepted before recording arrival' });
    }
    if (['resolved', 'closed', 'cancelled'].includes(status) && response.assignment_status !== 'accepted') {
      return res.status(409).json({ success: false, message: 'Assignment must be accepted before it can be resolved' });
    }
    const responseTimeSeconds = ['resolved', 'closed'].includes(status) && response.created_at
      ? Math.max(0, Math.round((Date.now() - new Date(response.created_at).getTime()) / 1000))
      : response.response_time_seconds;

    await response.update({ status, response_time_seconds: responseTimeSeconds });
    await incident.update({ status: incidentStatus });
    await recordAudit(req, { action: 'response_status_changed', resourceType: 'incident', resourceId: incidentId, details: `Response status changed to ${status}.` });
    const admins = await getActiveAdmins();
    const assignedOfficer = await User.findOne({ where: { user_id: response.responder_id, is_active: true } });
    await notifyUsers(req, { type: 'incident_status_changed', title: 'Incident status updated', message: `An incident is now ${incidentStatus}.`, resourceType: 'incident', resourceId: incidentId, link: `/incidents/${incidentId}`, dedupeKey: `status:${incidentId}:${incidentStatus}` }, [...admins, ...(assignedOfficer ? [assignedOfficer] : [])]);
    if (['resolved', 'closed', 'cancelled'].includes(status)) {
      await User.update({ availability_status: 'available' }, { where: { user_id: response.responder_id } });
    }
    const payload = {
      incident_id: incidentId,
      response_id: response.response_id,
      status,
      incident_status: incidentStatus,
      response_time_seconds: responseTimeSeconds
    };
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
    emitAssignmentEvent(req.app.get('io'), response.responder_id, 'incident-updated', updatedIncident);
    emitAssignmentEvent(req.app.get('io'), response.responder_id, 'officer_assignment', payload);
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
      location_accuracy,
      location_timestamp,
      is_anonymous,
      is_sos
    } = req.body;
    if (!type) {
      return res.status(400).json({ success: false, message: 'Incident type is required' });
    }
    const locationValidationError = validateLocationMetadata({
      latitude,
      longitude,
      location_accuracy,
      location_timestamp
    });
    if (locationValidationError) {
      return res.status(400).json({ success: false, message: locationValidationError });
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

    const requestedSeverity = ['low', 'medium', 'high', 'critical'].includes(
      String(severity || '').trim().toLowerCase()
    )
      ? String(severity).trim().toLowerCase()
      : 'medium';

    let incidentSeverity = requestedSeverity;

    if (!asBoolean(is_sos)) {
      try {
        const prediction = await predictRiskLevel({
          type,
          description: description || '',
          severity: requestedSeverity,
          location_name: location_name || '',
          building: building || '',
          room: room || ''
        });

        const predictedSeverity = String(prediction?.risk_level || '')
          .trim()
          .toLowerCase();

        if (['low', 'medium', 'high', 'critical'].includes(predictedSeverity)) {
          incidentSeverity = predictedSeverity;
        }
      } catch (error) {
        console.warn(
          'Incident risk prediction failed; using submitted severity:',
          error?.message || error
        );
      }
    }

    const incident = await Incident.create({
      user_id: asBoolean(is_anonymous) ? null : req.user.user_id,
      type,
      description: description || '',
      severity: incidentSeverity,
      location_name: location_name || '',
      building: building || '',
      room: room || '',
      floor: floor || '',
      latitude: latitude === '' || latitude == null ? null : latitude,
      longitude: longitude === '' || longitude == null ? null : longitude,
      location_accuracy: toOptionalNumber(location_accuracy),
      location_timestamp: toOptionalDate(location_timestamp),
      is_sos: asBoolean(is_sos),
      photos,
      is_anonymous: asBoolean(is_anonymous),
      status: 'reported'
    });
    const [incidentPayload] = await attachCampusLocationMatches([incident]);

    const alert = await Alert.create({
      incident_id: incident.incident_id,
      type: incident.is_sos ? 'sos_alert' : 'incident_reported',
      title: incident.is_sos ? 'SOS emergency reported' : 'New incident reported',
      message: `${incident.type} incident reported${incident.location_name ? ` at ${incident.location_name}` : ''}`,
      channel: 'dashboard',
      sent_at: new Date()
    });

    const admins = await getActiveAdmins();
    const isSOS = incident.is_sos;
    const io = req.app.get('io');
    if (io) {
      emitIncidentEvent(io, incident, isSOS ? 'sos_alert' : 'new-incident', incidentPayload);
      emitIncidentEvent(io, incident, 'alert-received', alert.toJSON());
    }

    const recipients = admins;
    await sendPushNotification(recipients, {
      title: isSOS ? 'SOS emergency reported' : 'New campus incident',
      body: `${incident.type} incident reported${incident.location_name ? ` at ${incident.location_name}` : ''}`,
      data: { incident_id: incident.incident_id, is_sos: isSOS }
    });
    await notifySecurityBySms(req.user.user_id, recipients, `${isSOS ? 'SOS ALERT' : 'INCIDENT ALERT'}: ${incident.type} reported${incident.location_name ? ` at ${incident.location_name}` : ''}.`);
    await notifyUsers(req, {
      type: isSOS ? 'sos_alert' : 'incident_reported',
      title: isSOS ? 'SOS emergency reported' : 'New campus incident',
      message: `${incident.type} incident reported${incident.location_name ? ` at ${incident.location_name}` : ''}`,
      resourceType: 'incident',
      resourceId: incident.incident_id,
      link: `/incidents/${incident.incident_id}`,
      dedupeKey: `${isSOS ? 'sos' : 'incident'}:${incident.incident_id}`
    }, admins);

    res.status(201).json({
      success: true,
      message: 'Incident reported successfully',
      data: {
        ...incidentPayload,
        photos: normalizePhotos(incident.photos)
          .map((photo) => getProtectedEvidenceUrl(incident.incident_id, photo))
          .filter(Boolean)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to report incident' });
  }
};

exports.createSOS = async (req, res) => {
  const userId = req.user.user_id;
  const { latitude = null, longitude = null, location_accuracy, location_timestamp } = req.body || {};
  const locationValidationError = validateLocationMetadata({
    latitude,
    longitude,
    location_accuracy,
    location_timestamp
  });
  if (locationValidationError) {
    return res.status(400).json({ success: false, message: locationValidationError });
  }

  const now = Date.now();
  const previousRequest = recentSOSRequests.get(userId);
  const sosCooldownSeconds = await getSetting('emergency.sos_cooldown_seconds') || 30;
  if (previousRequest && now - previousRequest < sosCooldownSeconds * 1000) {
    return res.status(429).json({ success: false, message: 'Please wait before sending another SOS alert' });
  }
  recentSOSRequests.set(userId, now);

  try {
    const incident = await Incident.create({
      user_id: userId,
      type: 'security_threat',
      description: 'SOS emergency alert sent from the Campus Security mobile app.',
      severity: 'critical',
      status: 'reported',
      location_name: latitude !== null && longitude !== null ? 'Current device location' : '',
      latitude: latitude === '' ? null : latitude,
      longitude: longitude === '' ? null : longitude,
      location_accuracy: toOptionalNumber(location_accuracy),
      location_timestamp: toOptionalDate(location_timestamp),
      is_sos: true,
      is_anonymous: false,
      photos: []
    });
    const [incidentPayload] = await attachCampusLocationMatches([incident]);
    const autoAssignEnabled = await getSetting('emergency.sos_auto_assign_enabled');
    const nearestOfficer = autoAssignEnabled
      ? await findNearestAvailableOfficer(latitude, longitude)
      : null;
    let assignment = null;
    if (nearestOfficer) {
      const response = await assignIncidentToOfficer(incident, nearestOfficer.officer, null);
      assignment = assignmentPayload(incident, nearestOfficer.officer, nearestOfficer.distanceMeters, null, 'pending', response.response_id);
    }

    const alert = await Alert.create({
      incident_id: incident.incident_id,
      type: 'sos_alert',
      title: 'SOS emergency reported',
      message: 'A critical SOS emergency alert was reported.',
      channel: 'dashboard',
      sent_at: new Date()
    });
    await recordAudit(req, { action: 'sos_created', resourceType: 'incident', resourceId: incident.incident_id });

    const admins = await getActiveAdmins();
    await notifyUsers(req, {
      type: 'sos_alert',
      title: 'SOS emergency reported',
      message: 'A critical SOS emergency alert was reported.',
      resourceType: 'incident',
      resourceId: incident.incident_id,
      link: `/incidents/${incident.incident_id}`,
      dedupeKey: `sos:${incident.incident_id}`
    }, admins);

    const reporter = { user_id: userId, name: req.user.name, role: req.user.role };
    const sosPayload = { ...incidentPayload, reporter, assignment };
    const io = req.app.get('io');
    if (io) {
      emitIncidentEvent(io, incident, 'sos_alert', sosPayload);
      emitIncidentEvent(io, incident, 'alert-received', alert.toJSON());
      if (assignment) emitAssignmentEvent(io, nearestOfficer.officer.user_id, 'incident_assigned', assignment);
      if (assignment) emitAssignmentEvent(io, nearestOfficer.officer.user_id, 'officer_assignment', assignment);
    }

    await sendPushNotification(admins, {
      title: 'SOS emergency reported',
      body: 'A critical SOS emergency alert was reported.',
      data: { incident_id: incident.incident_id, is_sos: true }
    });
    await notifySecurityBySms(
      userId,
      admins,
      `SOS ALERT: A critical security emergency was reported at ${incident.location_name || 'campus'} for incident #${incident.incident_id}.`
    );

    return res.status(201).json({
      success: true,
      message: 'SOS Alert Sent',
      data: { ...incidentPayload, assignment }
    });
  } catch (error) {
    recentSOSRequests.delete(userId);
    return res.status(500).json({ success: false, message: 'Failed to send SOS alert' });
  }
};

exports.getAll = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    let where = role === 'admin' ? {} : { user_id: req.user.user_id };

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

    const matchedIncidents = await attachCampusLocationMatches(incidents);
    return res.status(200).json({
      success: true,
      data: matchedIncidents.map((incident) => ({
        ...incident,
        photos: normalizePhotos(incident.photos)
          .map((photo) => getProtectedEvidenceUrl(incident.incident_id, photo))
          .filter(Boolean)
      }))
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch incidents' });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    const privilegedRole = role === 'admin' || isSecurityRole(role);
    const where = privilegedRole ? {} : { user_id: req.user.user_id };
    if (!privilegedRole) {
      const clearedHistory = await IncidentHistoryClear.findByPk(req.user.user_id);
      if (clearedHistory) where.created_at = { [Op.gt]: clearedHistory.cleared_at };
    }

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
    const matchedIncidents = await attachCampusLocationMatches(incidents);
    return res.status(200).json({
      success: true,
      data: matchedIncidents.map((incident) => ({
        ...incident,
        photos: normalizePhotos(incident.photos)
          .map((photo) => getProtectedEvidenceUrl(incident.incident_id, photo))
          .filter(Boolean)
      }))
    });
  } catch (error) {
    console.error('Unable to load incident history:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Failed to fetch incident history' });
  }
};

exports.serveEvidence = async (req, res) => {
  try {
    const incident = await Incident.findByPk(req.params.incident_id);
    const filename = req.params.filename;
    const role = normalizeRole(req.user?.role);
    const assignedOfficer = isSecurityRole(role)
      ? await Response.findOne({
        where: { incident_id: req.params.incident_id, responder_id: req.user.user_id }
      })
      : null;
    if (!incident || (!canAccessIncidentEvidence(req.user, incident) && !assignedOfficer) || !isStoredEvidence(incident, filename)) {
      return res.status(404).json({ success: false, message: 'Evidence not found' });
    }

    const evidencePath = resolveEvidencePath(filename);
    if (!evidencePath || !evidenceExists(evidencePath)) {
      return res.status(404).json({ success: false, message: 'Evidence not found' });
    }

    await recordAudit(req, { action: 'evidence_accessed', resourceType: 'incident_evidence', resourceId: req.params.incident_id, details: filename });
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
    await recordAudit(req, { action: 'incident_status_changed', resourceType: 'incident', resourceId: incident_id, details: `Incident status changed to ${status}.` });
    const assignedResponse = await Response.findOne({ where: { incident_id } });
    const admins = await getActiveAdmins();
    const assignedOfficer = assignedResponse
      ? await User.findOne({ where: { user_id: assignedResponse.responder_id, is_active: true } })
      : null;
    await notifyUsers(req, { type: 'incident_status_changed', title: 'Incident status updated', message: `An incident is now ${status}.`, resourceType: 'incident', resourceId: incident_id, link: `/incidents/${incident_id}`, dedupeKey: `status-direct:${incident_id}:${status}` }, [...admins, ...(assignedOfficer ? [assignedOfficer] : [])]);
    if (assignedResponse) {
      const responseStatus = status === 'on_scene' ? 'responding' : status === 'dispatched' ? 'assigned' : status;
      if (['assigned', 'responding', 'resolved', 'closed'].includes(responseStatus)) {
        await assignedResponse.update({ status: responseStatus });
      }
      if (['resolved', 'closed', 'cancelled'].includes(status)) {
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
    await recordAudit(req, { action: 'incident_created', resourceType: 'incident', resourceId: incident.incident_id, details: incident.photos?.length ? 'Incident created with evidence.' : null });
    const io = req.app.get('io');
    if (io) {
      emitAssignmentEvent(io, assignedResponse?.responder_id, 'incident-updated', incident.toJSON());
      emitAssignmentEvent(io, assignedResponse?.responder_id, 'alert-received', alert.toJSON());
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
