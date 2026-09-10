const { Incident, Alert, Response } = require('../models');

const SUPPORTED_ROLES = new Set(['student', 'faculty', 'staff', 'security', 'admin']);
const ACTIVE_STATUSES = ['reported', 'investigating', 'acknowledged', 'dispatched', 'on_scene'];

const toPlain = (value) => {
  if (!value) return value;
  if (typeof value.toJSON === 'function') return value.toJSON();
  return value;
};

const projectIncident = (incident, responseByIncidentId = new Map()) => {
  const value = toPlain(incident);
  const response = responseByIncidentId.get(value.incident_id);
  return {
    incident_id: value.incident_id,
    type: value.type,
    severity: value.severity,
    status: value.status,
    location_name: value.location_name,
    created_at: value.created_at,
    response: response ? {
      status: response.status,
      response_time_seconds: response.response_time_seconds
    } : null
  };
};

const getIncidentContext = async (user) => {
  const isPrivileged = ['security', 'admin'].includes(user.role);
  if (user.role === 'security') {
    const assignments = await Response.findAll({
      where: { responder_id: user.user_id },
      attributes: ['incident_id', 'status', 'response_time_seconds']
    });
    const incidentIds = assignments.map((assignment) => toPlain(assignment).incident_id);
    const incidents = incidentIds.length
      ? await Incident.findAll({ where: { incident_id: incidentIds }, attributes: ['incident_id', 'type', 'severity', 'status', 'location_name', 'created_at'], order: [['created_at', 'DESC']] })
      : [];
    const assignedIncidents = incidents.map((incident) => projectIncident(incident, new Map(assignments.map((assignment) => [toPlain(assignment).incident_id, toPlain(assignment)]))));
    return {
      assigned_incidents: assignedIncidents,
      latest_assigned_incident: assignedIncidents[0] || null
    };
  }

  const incidents = await Incident.findAll({
    where: isPrivileged ? {} : { user_id: user.user_id },
    attributes: ['incident_id', 'type', 'severity', 'status', 'location_name', 'created_at'],
    order: [['created_at', 'DESC']],
    limit: isPrivileged ? 100 : 20
  });
  const incidentValues = incidents.map((incident) => toPlain(incident));
  const incidentIds = incidentValues.map((incident) => incident.incident_id);
  const responses = incidentIds.length
    ? await Response.findAll({ where: { incident_id: incidentIds }, attributes: ['incident_id', 'status', 'response_time_seconds'] })
    : [];
  const responseMap = new Map(responses.map((response) => [toPlain(response).incident_id, toPlain(response)]));
  const projectedIncidents = incidentValues.map((incident) => projectIncident(incident, responseMap));
  const context = {
    incidents: projectedIncidents,
    latest_incident: projectedIncidents[0] || null
  };

  if (!isPrivileged) {
    const alerts = incidentIds.length
      ? await Alert.findAll({ where: { incident_id: incidentIds }, attributes: ['incident_id', 'type', 'title', 'message', 'sent_at'], order: [['sent_at', 'DESC']], limit: 20 })
      : [];
    context.alerts = alerts.map((alert) => {
      const value = toPlain(alert);
      return { incident_id: value.incident_id, type: value.type, title: value.title, message: value.message, sent_at: value.sent_at };
    });
  }

  if (user.role === 'admin') {
    const active = await Incident.count({ where: { status: ACTIVE_STATUSES } });
    const resolved = await Incident.count({ where: { status: ['resolved', 'closed'] } });
    const total = await Incident.count();
    context.statistics = { total, active, resolved };
  }

  return context;
};

const buildAuthorizedContext = async (user) => {
  if (!user || !SUPPORTED_ROLES.has(user.role)) {
    throw new Error('Unsupported assistant role');
  }

  return {
    role: user.role,
    authorized_data: await getIncidentContext(user)
  };
};

module.exports = { buildAuthorizedContext, SUPPORTED_ROLES };