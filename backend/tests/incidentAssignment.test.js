const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { authorize } = require('../src/middleware/auth');
const incidentController = require('../src/controllers/incidentController');
const { Alert, AuditLog, Incident, Notification, Response, sequelize, User } = require('../src/models');
const incidentId = '11111111-1111-4111-8111-111111111111';
const officerId = '22222222-2222-4222-8222-222222222222';

function makeResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; }
  };
}

function makeIncident() {
  return {
    incident_id: incidentId,
    status: 'reported',
    location_name: 'Library',
    latitude: null,
    longitude: null,
    created_at: new Date('2026-09-09T10:00:00.000Z'),
    toJSON() { return { incident_id: this.incident_id, status: this.status, location_name: this.location_name }; },
    async update(values) { Object.assign(this, values); }
  };
}

const originalIncidentFindByPk = Incident.findByPk;
const originalResponseFindOne = Response.findOne;
const originalResponseCreate = Response.create;
const originalResponseFindAll = Response.findAll;
const originalResponseFindByPk = Response.findByPk;
const originalUserFindOne = User.findOne;
const originalUserFindAll = User.findAll;
const originalUserUpdate = User.update;
const originalNotificationFindOrCreate = Notification.findOrCreate;
const originalAlertCreate = Alert.create;
const originalAuditLogCreate = AuditLog.create;
const originalTransaction = sequelize.transaction;

test.afterEach(() => {
  Incident.findByPk = originalIncidentFindByPk;
  Response.findOne = originalResponseFindOne;
  Response.create = originalResponseCreate;
  Response.findAll = originalResponseFindAll;
  Response.findByPk = originalResponseFindByPk;
  User.findOne = originalUserFindOne;
  User.findAll = originalUserFindAll;
  User.update = originalUserUpdate;
  Notification.findOrCreate = originalNotificationFindOrCreate;
  Alert.create = originalAlertCreate;
  AuditLog.create = originalAuditLogCreate;
  sequelize.transaction = originalTransaction;
});

function makeResponseAssignment(assignmentStatus, status = 'assigned') {
  return {
    response_id: `response-${assignmentStatus}-${status}`,
    incident_id: incidentId,
    responder_id: officerId,
    assignment_status: assignmentStatus,
    status,
    created_at: new Date(),
    response_time_seconds: null,
    async update(values) { Object.assign(this, values); },
    toJSON() {
      return {
        response_id: this.response_id,
        incident_id: this.incident_id,
        responder_id: this.responder_id,
        assignment_status: this.assignment_status,
        status: this.status
      };
    }
  };
}

async function recordArrival(assignments) {
  const incident = makeIncident();
  Response.findAll = async () => assignments;
  Incident.findByPk = async () => incident;
  User.findAll = async () => [];
  User.findOne = async () => ({ user_id: officerId, is_active: true });
  User.update = async () => undefined;
  Notification.findOrCreate = async () => [null, false];
  Alert.create = async () => null;
  AuditLog.create = async () => null;

  const response = makeResponse();
  await incidentController.updateResponseStatus({
    params: { incident_id: incidentId },
    body: { status: 'responding' },
    user: { role: 'security', user_id: officerId },
    app: { get: () => null }
  }, response);
  return { response, incident };
}

test('security officer with available status can be assigned', async () => {
  const incident = makeIncident();
  const officer = { user_id: officerId, name: 'Officer Test', role: 'security', availability_status: 'available', latitude: null, longitude: null, async update(values) { Object.assign(this, values); } };
  Incident.findByPk = async () => incident;
  Response.findOne = async () => null;
  User.findOne = async () => officer;
  Response.create = async () => ({ response_id: 'response-1', responder_id: officer.user_id, assignment_status: 'pending', status: 'assigned', toJSON() { return { response_id: this.response_id, responder_id: this.responder_id, assignment_status: this.assignment_status, status: this.status }; } });

  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: incident.incident_id }, body: { officer_id: officer.user_id }, user: { user_id: '33333333-3333-4333-8333-333333333333', role: 'admin' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.data.responses[0].responder.name, 'Officer Test');
  assert.equal(response.payload.data.status, 'reported');
  assert.equal(response.payload.assignment.assignment_status, 'pending');
  assert.equal(officer.availability_status, 'available');
});

test('security_officer with available status can be assigned', async () => {
  const incident = makeIncident();
  const officer = { user_id: officerId, name: 'Officer Legacy', role: 'security_officer', availability_status: 'available', latitude: null, longitude: null, async update(values) { Object.assign(this, values); } };
  Incident.findByPk = async () => incident;
  Response.findOne = async () => null;
  User.findOne = async () => officer;
  Response.create = async () => ({ response_id: 'response-legacy', responder_id: officer.user_id, assignment_status: 'pending', status: 'assigned', toJSON() { return { response_id: this.response_id, responder_id: this.responder_id, assignment_status: this.assignment_status, status: this.status }; } });

  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: incident.incident_id }, body: { officer_id: officer.user_id }, user: { user_id: '33333333-3333-4333-8333-333333333333', role: 'admin' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.assignment.responder.role, 'security_officer');
  assert.equal(response.payload.assignment.assignment_status, 'pending');
});

test('Admin assignment notification and events target only the assigned officer and Admin', async () => {
  const incident = makeIncident();
  const officer = { user_id: officerId, name: 'Officer Assigned', role: 'security_officer', availability_status: 'available', latitude: null, longitude: null, async update(values) { Object.assign(this, values); } };
  const notificationRecipients = [];
  const eventRecipients = [];
  const socket = {
    rooms: [],
    to(room) { this.rooms.push(room); return this; },
    emit(event) { eventRecipients.push({ event, rooms: [...this.rooms] }); this.rooms = []; }
  };
  Incident.findByPk = async () => incident;
  Response.findOne = async () => null;
  User.findOne = async () => officer;
  Response.create = async () => ({ response_id: 'response-targeted', responder_id: officer.user_id, assignment_status: 'pending', status: 'assigned', toJSON() { return { response_id: this.response_id, responder_id: this.responder_id, assignment_status: this.assignment_status, status: this.status }; } });
  Notification.findOrCreate = async ({ defaults }) => {
    notificationRecipients.push(defaults.user_id);
    return [{ ...defaults, toJSON() { return defaults; } }, true];
  };

  const response = makeResponse();
  await incidentController.assignIncident({
    params: { incident_id: incident.incident_id },
    body: { officer_id: officer.user_id },
    user: { user_id: '33333333-3333-4333-8333-333333333333', role: 'admin' },
    app: { get: () => socket }
  }, response);

  assert.equal(response.statusCode, 201);
  assert.deepEqual(notificationRecipients, [officer.user_id]);
  const assignmentEvents = eventRecipients.filter(({ event }) => event !== 'notification-created');
  assert.equal(assignmentEvents.length, 3);
  assert.ok(assignmentEvents.every(({ rooms }) => rooms.includes('role:admin')));
  assert.ok(assignmentEvents.every(({ rooms }) => rooms.includes(`user:${officer.user_id}`)));
  assert.ok(assignmentEvents.every(({ rooms }) => !rooms.includes('role:security')));
});

test('keeps a connected web officer available while a request is pending', async () => {
  const incident = makeIncident();
  const officer = { user_id: officerId, name: 'Web Officer', role: 'security', availability_status: 'available', latitude: null, longitude: null, async update(values) { Object.assign(this, values); } };
  Incident.findByPk = async () => incident;
  Response.findOne = async () => null;
  User.findOne = async () => officer;
  Response.create = async () => ({ response_id: 'response-2', responder_id: officer.user_id, assignment_status: 'pending', status: 'assigned', toJSON() { return { response_id: this.response_id, responder_id: this.responder_id, assignment_status: this.assignment_status, status: this.status }; } });

  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: incident.incident_id }, body: { officer_id: officer.user_id }, user: { user_id: '33333333-3333-4333-8333-333333333333', role: 'admin' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.assignment.responder.user_id, officer.user_id);
  assert.equal(response.payload.assignment.assignment_status, 'pending');
  assert.equal(officer.availability_status, 'available');
});

test('nonexistent officer returns appropriate error', async () => {
  const incident = makeIncident();
  Incident.findByPk = async () => incident;
  Response.findOne = async () => null;
  User.findOne = async () => null;

  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: incident.incident_id }, body: { officer_id: officerId }, user: { role: 'security' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 404);
  assert.match(response.payload.message, /security officer not found/i);
});

test('unauthorized user cannot assign', () => {
  const response = makeResponse();
  let called = false;
  authorize('security', 'admin')({ user: { role: 'student' } }, response, () => { called = true; });

  assert.equal(called, false);
  assert.equal(response.statusCode, 403);
});

test('rejects assignment for an inactive incident', async () => {
  const incident = makeIncident();
  incident.status = 'resolved';
  Incident.findByPk = async () => incident;

  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: incident.incident_id }, body: { officer_id: officerId }, user: { user_id: '33333333-3333-4333-8333-333333333333', role: 'admin' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 409);
  assert.match(response.payload.message, /not active/i);
});

test('duplicate or active assignment is rejected appropriately', async () => {
  Incident.findByPk = async () => makeIncident();
  Response.findOne = async () => ({ response_id: 'existing-response', assignment_status: 'accepted' });

  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: incidentId }, body: { officer_id: officerId }, user: { role: 'admin' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 409);
  assert.match(response.payload.message, /pending or accepted/i);
});

test('enforces security/admin authorization for assignment', () => {
  const response = makeResponse();
  let called = false;
  authorize('security', 'admin')({ user: { role: 'student' } }, response, () => { called = true; });

  assert.equal(called, false);
  assert.equal(response.statusCode, 403);
});

test('rejects malformed incident or officer IDs', async () => {
  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: 'not-an-incident-id' }, body: { officer_id: 'not-an-officer-id' }, user: { role: 'admin' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.payload.message, /valid UUIDs/i);
});

test('successful assignment creates/updates the correct Response and Incident state', async () => {
  const incident = makeIncident();
  const officer = { user_id: officerId, name: 'Officer Success', role: 'security', availability_status: 'available', latitude: null, longitude: null, async update(values) { Object.assign(this, values); } };
  Incident.findByPk = async () => incident;
  Response.findOne = async () => null;
  User.findOne = async () => officer;
  Response.create = async () => ({ response_id: 'response-success', incident_id: incident.incident_id, responder_id: officer.user_id, assigned_by: '33333333-3333-4333-8333-333333333333', status: 'assigned', assignment_status: 'pending', toJSON() { return { response_id: this.response_id, incident_id: this.incident_id, responder_id: this.responder_id, assigned_by: this.assigned_by, status: this.status, assignment_status: this.assignment_status }; } });

  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: incident.incident_id }, body: { officer_id: officer.user_id }, user: { user_id: '33333333-3333-4333-8333-333333333333', role: 'admin' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.assignment.assignment_status, 'pending');
  assert.equal(response.payload.data.status, 'reported');
  assert.equal(response.payload.assignment.responder.user_id, officer.user_id);
});

test('creates a pending assignment request without immediately marking the officer responding', async () => {
  const incident = makeIncident();
  const officer = { user_id: officerId, name: 'Officer Test', role: 'security', availability_status: 'available', latitude: null, longitude: null, async update(values) { Object.assign(this, values); } };
  Incident.findByPk = async () => incident;
  Response.findOne = async () => null;
  User.findOne = async () => officer;
  Response.create = async () => ({ response_id: 'request-1', incident_id: incident.incident_id, responder_id: officer.user_id, assignment_status: 'pending', status: 'assigned', toJSON() { return { response_id: this.response_id, incident_id: this.incident_id, responder_id: this.responder_id, assignment_status: this.assignment_status, status: this.status }; } });

  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: incident.incident_id }, body: { officer_id: officer.user_id }, user: { user_id: '33333333-3333-4333-8333-333333333333', role: 'admin' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.assignment.assignment_status, 'pending');
  assert.equal(officer.availability_status, 'available');
});

test('returns only the authenticated officer pending assignments', async () => {
  const pendingAssignment = {
    response_id: 'request-2',
    responder_id: officerId,
    assignment_status: 'pending',
    status: 'assigned',
    incident_id: incidentId,
    created_at: new Date(),
    incident: {
      toJSON() { return { incident_id: incidentId, type: 'theft', status: 'reported', location_name: 'Library' }; }
    },
    responder: {
      toJSON() { return { user_id: officerId, name: 'Officer Test', role: 'security' }; }
    },
    toJSON() { return { response_id: this.response_id, responder_id: this.responder_id, assignment_status: this.assignment_status, incident_id: this.incident_id, status: this.status }; }
  };
  Response.findAll = async () => [pendingAssignment];

  const response = makeResponse();
  await incidentController.getPendingAssignments({ user: { role: 'security', user_id: officerId } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.data[0].assignment_status, 'pending');
  assert.equal(response.payload.data[0].responder.user_id, officerId);
});

test('allows an officer to accept their pending assignment', async () => {
  const incident = makeIncident();
  const assignment = {
    response_id: '44444444-4444-4444-8444-444444444444',
    incident_id: incident.incident_id,
    responder_id: officerId,
    assignment_status: 'pending',
    status: 'assigned',
    incident: { ...incident, update: async (values) => Object.assign(incident, values) },
    responder: { user_id: officerId, name: 'Officer Test', role: 'security' },
    async update(values) { Object.assign(this, values); }
  };
  Response.findByPk = async () => assignment;
  User.update = async () => undefined;

  const response = makeResponse();
  await incidentController.acceptAssignment({ params: { response_id: assignment.response_id }, user: { role: 'security', user_id: officerId }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(assignment.assignment_status, 'accepted');
  assert.equal(assignment.status, 'responding');
});

test('allows an officer to decline their pending assignment', async () => {
  const incident = makeIncident();
  const assignment = {
    response_id: '55555555-5555-4555-8555-555555555555',
    incident_id: incident.incident_id,
    responder_id: officerId,
    assignment_status: 'pending',
    status: 'assigned',
    incident: { ...incident, update: async (values) => Object.assign(incident, values) },
    responder: { user_id: officerId, name: 'Officer Test', role: 'security' },
    async update(values) { Object.assign(this, values); }
  };
  Response.findByPk = async () => assignment;
  User.update = async () => undefined;

  const response = makeResponse();
  await incidentController.declineAssignment({ params: { response_id: assignment.response_id }, user: { role: 'security', user_id: officerId }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(assignment.assignment_status, 'declined');
});

test('rejects arrival for a pending assignment with the existing validation message', async () => {
  const pendingAssignment = makeResponseAssignment('pending');
  const { response, incident } = await recordArrival([pendingAssignment]);

  assert.equal(response.statusCode, 409);
  assert.equal(response.payload.message, 'Assignment must be accepted before recording arrival');
  assert.equal(pendingAssignment.assignment_status, 'pending');
  assert.equal(pendingAssignment.status, 'assigned');
  assert.equal(incident.status, 'reported');
});

test('serializes repeated assignments and does not create another active Response', async () => {
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    async commit() {},
    async rollback() {}
  };
  const pendingAssignment = makeResponseAssignment('pending');
  sequelize.transaction = async () => transaction;
  Incident.findByPk = async (_incidentId, options) => {
    assert.equal(options.transaction, transaction);
    assert.equal(options.lock, transaction.LOCK.UPDATE);
    return makeIncident();
  };
  Response.findOne = async ({ where, transaction: queryTransaction }) => {
    assert.deepEqual(where, {
      incident_id: incidentId,
      assignment_status: { [Op.in]: ['pending', 'accepted'] }
    });
    assert.equal(queryTransaction, transaction);
    return pendingAssignment;
  };
  Response.create = async () => {
    assert.fail('A repeated active assignment must not create another Response');
  };

  const response = makeResponse();
  await incidentController.assignIncident({
    params: { incident_id: incidentId },
    body: { officer_id: officerId },
    user: { user_id: '33333333-3333-4333-8333-333333333333', role: 'admin' },
    app: { get: () => null }
  }, response);

  assert.equal(response.statusCode, 409);
  assert.equal(response.payload.message, 'Incident already has a pending or accepted assignment request');
});

test('allows arrival for an accepted assignment even when an older declined response exists', async () => {
  const declined = makeResponseAssignment('declined');
  const accepted = makeResponseAssignment('accepted');
  const { response, incident } = await recordArrival([declined, accepted]);

  assert.equal(response.statusCode, 200);
  assert.equal(accepted.status, 'responding');
  assert.equal(incident.status, 'on_scene');
  assert.equal(response.payload.data.incident_status, 'on_scene');
});

test('allows arrival for an accepted assignment whose response is already responding', async () => {
  const accepted = makeResponseAssignment('accepted', 'responding');
  const { response, incident } = await recordArrival([accepted]);

  assert.equal(response.statusCode, 200);
  assert.equal(incident.status, 'on_scene');
  assert.equal(response.payload.data.incident_status, 'on_scene');
});

test('keeps a declined assignment available for reassignment', async () => {
  const incident = makeIncident();
  const officer = { user_id: officerId, name: 'Officer Reassigned', role: 'security', availability_status: 'available', latitude: null, longitude: null, async update(values) { Object.assign(this, values); } };
  const declined = makeResponseAssignment('declined');
  Incident.findByPk = async () => incident;
  Response.findOne = async ({ where }) => {
    if (where?.assignment_status) {
      assert.deepEqual(where.assignment_status[Op.in], ['pending', 'accepted']);
    }
    return null;
  };
  User.findOne = async () => officer;
  User.findAll = async () => [];
  Response.create = async () => makeResponseAssignment('pending');
  Notification.findOrCreate = async () => [null, false];
  AuditLog.create = async () => null;
  const response = makeResponse();

  await incidentController.assignIncident({
    params: { incident_id: incidentId },
    body: { officer_id: officerId },
    user: { user_id: '33333333-3333-4333-8333-333333333333', role: 'admin' },
    app: { get: () => null }
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(declined.assignment_status, 'declined');
});

test('prevents an officer from accepting another officer assignment', async () => {
  const incident = makeIncident();
  const assignment = {
    response_id: '66666666-6666-4666-8666-666666666666',
    incident_id: incident.incident_id,
    responder_id: officerId,
    assignment_status: 'pending',
    status: 'assigned',
    incident: { ...incident },
    responder: { user_id: officerId, name: 'Officer Test', role: 'security' },
    async update() {}
  };
  Response.findByPk = async () => assignment;

  const response = makeResponse();
  await incidentController.acceptAssignment({ params: { response_id: assignment.response_id }, user: { role: 'security', user_id: '77777777-7777-4777-8777-777777777777' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 403);
});

test('prevents an officer from declining another officer assignment', async () => {
  const incident = makeIncident();
  const assignment = {
    response_id: '88888888-8888-4888-8888-888888888888',
    incident_id: incident.incident_id,
    responder_id: officerId,
    assignment_status: 'pending',
    status: 'assigned',
    incident: { ...incident },
    responder: { user_id: officerId, name: 'Officer Test', role: 'security' },
    async update() {}
  };
  Response.findByPk = async () => assignment;

  const response = makeResponse();
  await incidentController.declineAssignment({ params: { response_id: assignment.response_id }, user: { role: 'security', user_id: '99999999-9999-4999-8999-999999999999' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 403);
});

test('responding officer returns 409', async () => {
  const incident = makeIncident();
  const officer = { user_id: officerId, name: 'Busy Officer', role: 'security', availability_status: 'responding', latitude: null, longitude: null, async update() {} };
  Incident.findByPk = async () => incident;
  Response.findOne = async (query) => {
    if (query && query.where && query.where.responder_id === officer.user_id && query.where.status === 'responding') {
      return { responder_id: officer.user_id, status: 'responding' };
    }
    return null;
  };
  User.findOne = async () => officer;

  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: incident.incident_id }, body: { officer_id: officer.user_id }, user: { user_id: '33333333-3333-4333-8333-333333333333', role: 'admin' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 409);
  assert.match(response.payload.message, /already responding/i);
});

test('offline officer returns 409', async () => {
  const incident = makeIncident();
  const officer = { user_id: officerId, name: 'Offline Officer', role: 'security', availability_status: 'offline', latitude: null, longitude: null, async update() {} };
  Incident.findByPk = async () => incident;
  Response.findOne = async () => null;
  User.findOne = async () => officer;

  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: incident.incident_id }, body: { officer_id: officer.user_id }, user: { user_id: '33333333-3333-4333-8333-333333333333', role: 'admin' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 409);
  assert.match(response.payload.message, /not available/i);
});

test('busy officer returns 409 if business rules require busy to be non-assignable', async () => {
  const incident = makeIncident();
  const officer = { user_id: officerId, name: 'Busy Officer', role: 'security', availability_status: 'busy', latitude: null, longitude: null, async update() {} };
  Incident.findByPk = async () => incident;
  Response.findOne = async () => null;
  User.findOne = async () => officer;

  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: incident.incident_id }, body: { officer_id: officer.user_id }, user: { user_id: '33333333-3333-4333-8333-333333333333', role: 'admin' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 409);
  assert.match(response.payload.message, /not available/i);
});