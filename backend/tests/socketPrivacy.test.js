const test = require('node:test');
const assert = require('node:assert/strict');
const incidentController = require('../src/controllers/incidentController');
const { Alert, AuditLog, Incident, Notification, SystemSetting, User } = require('../src/models');

const originalIncidentCreate = Incident.create;
const originalAlertCreate = Alert.create;
const originalUserFindAll = User.findAll;
const originalUserFindOne = User.findOne;
const originalNotificationFindOrCreate = Notification.findOrCreate;
const originalAuditLogCreate = AuditLog.create;
const originalSystemSettingFindByPk = SystemSetting.findByPk;

test.afterEach(() => {
  Incident.create = originalIncidentCreate;
  Alert.create = originalAlertCreate;
  User.findAll = originalUserFindAll;
  User.findOne = originalUserFindOne;
  Notification.findOrCreate = originalNotificationFindOrCreate;
  AuditLog.create = originalAuditLogCreate;
  SystemSetting.findByPk = originalSystemSettingFindByPk;
});

const makeIncident = (userId) => ({
  incident_id: `incident-${userId}`,
  user_id: userId,
  type: 'theft',
  description: 'A reported incident',
  severity: 'medium',
  status: 'reported',
  location_name: 'Library',
  is_sos: false,
  created_at: new Date('2026-09-09T10:00:00.000Z'),
  toJSON() {
    return {
      incident_id: this.incident_id,
      user_id: this.user_id,
      type: this.type,
      description: this.description,
      severity: this.severity,
      status: this.status,
      location_name: this.location_name,
      is_sos: this.is_sos,
      created_at: this.created_at
    };
  }
});

const makeAlert = (incidentId) => ({
  incident_id: incidentId,
  alert_id: `alert-${incidentId}`,
  type: 'incident_reported',
  toJSON() {
    return { ...this };
  }
});

const makeSocket = () => {
  const socket = {
    broadcasts: [],
    roomTargets: [],
    emit() {
      throw new Error('Unscoped Socket.IO broadcast was used');
    },
    to(room) {
      this.roomTargets.push(room);
      return this;
    }
  };
  socket.emit = (event, payload) => {
    if (event === 'new-incident' || event === 'sos_alert' || event === 'alert-received') {
      socket.broadcasts.push({ event, payload, rooms: [...socket.roomTargets] });
    }
    socket.roomTargets = [];
  };
  return socket;
};

const makeResponse = () => ({
  statusCode: null,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return payload;
  }
});

const createRequest = (userId, socket) => ({
  body: { type: 'theft', description: 'A reported incident' },
  files: [],
  user: { user_id: userId, role: 'student' },
  protocol: 'http',
  get: () => 'localhost',
  app: { get: () => socket }
});

test('routes new incident events to Admin and the reporter only', async () => {
  const incident = makeIncident('student-a');
  const socket = makeSocket();
  Incident.create = async () => incident;
  Alert.create = async () => makeAlert(incident.incident_id);
  User.findAll = async () => [];

  const response = makeResponse();
  await incidentController.create(createRequest('student-a', socket), response);

  assert.equal(response.statusCode, 201);
  assert.equal(socket.broadcasts.length, 2);
  assert.deepEqual(socket.broadcasts.map(({ rooms }) => rooms), [
    ['role:admin', 'user:student-a'],
    ['role:admin', 'user:student-a']
  ]);
  assert.ok(socket.broadcasts.every(({ rooms }) => !rooms.includes('role:security')));
});

test('persists the initial incident notification for Admin only', async () => {
  const incident = makeIncident('student-notification');
  const socket = makeSocket();
  const recipientIds = [];
  let adminQuery;
  Incident.create = async () => incident;
  Alert.create = async () => makeAlert(incident.incident_id);
  User.findAll = async (query) => {
    adminQuery = query;
    return [{ user_id: 'admin-1', role: 'admin', is_active: true }];
  };
  Notification.findOrCreate = async ({ defaults }) => {
    recipientIds.push(defaults.user_id);
    return [{ ...defaults, toJSON() { return defaults; } }, true];
  };

  const response = makeResponse();
  await incidentController.create(createRequest('student-notification', socket), response);

  assert.equal(response.statusCode, 201);
  assert.equal(adminQuery.where.role, 'admin');
  assert.deepEqual(recipientIds, ['admin-1']);
});

test('routes SOS incidents created through the incident endpoint to Admin and reporter only', async () => {
  const incident = { ...makeIncident('student-sos-form'), is_sos: true };
  const socket = makeSocket();
  Incident.create = async () => incident;
  Alert.create = async () => makeAlert(incident.incident_id);
  User.findAll = async () => [];
  const request = createRequest('student-sos-form', socket);
  request.body.is_sos = true;

  const response = makeResponse();
  await incidentController.create(request, response);

  assert.equal(response.statusCode, 201);
  assert.deepEqual(socket.broadcasts.map(({ event }) => event), ['sos_alert', 'alert-received']);
  assert.ok(socket.broadcasts.every(({ rooms }) => rooms.includes('role:admin')));
  assert.ok(socket.broadcasts.every(({ rooms }) => rooms.includes('user:student-sos-form')));
  assert.ok(socket.broadcasts.every(({ rooms }) => !rooms.includes('role:security')));
});

test('does not target other users when a different student reports an incident', async () => {
  const incident = makeIncident('student-b');
  const socket = makeSocket();
  Incident.create = async () => incident;
  Alert.create = async () => makeAlert(incident.incident_id);
  User.findAll = async () => [];

  const response = makeResponse();
  await incidentController.create(createRequest('student-b', socket), response);

  assert.equal(response.statusCode, 201);
  assert.ok(socket.broadcasts.every(({ rooms }) => rooms.includes('user:student-b')));
  assert.ok(socket.broadcasts.every(({ rooms }) => !rooms.includes('user:student-a')));
  assert.ok(socket.broadcasts.every(({ rooms }) => !rooms.includes('role:security')));
});

test('routes new SOS events to Admin and the reporter without notifying other officers', async () => {
  const incident = { ...makeIncident('student-sos'), is_sos: true };
  const socket = makeSocket();
  const notificationRecipients = [];
  Incident.create = async () => incident;
  Alert.create = async () => makeAlert(incident.incident_id);
  User.findAll = async () => [{ user_id: 'admin-1', role: 'admin', is_active: true }];
  User.findOne = async () => null;
  Notification.findOrCreate = async ({ defaults }) => {
    notificationRecipients.push(defaults.user_id);
    return [{ ...defaults, toJSON() { return defaults; } }, true];
  };
  AuditLog.create = async () => undefined;
  SystemSetting.findByPk = async () => ({ value: 0 });

  const response = makeResponse();
  await incidentController.createSOS({
    body: {},
    user: { user_id: 'student-sos', name: 'Student SOS', role: 'student' },
    app: { get: () => socket }
  }, response);

  assert.equal(response.statusCode, 201);
  const sosEvents = socket.broadcasts.filter(({ event }) => event === 'sos_alert' || event === 'alert-received');
  assert.equal(sosEvents.length, 2);
  assert.ok(sosEvents.every(({ rooms }) => rooms.includes('role:admin')));
  assert.ok(sosEvents.every(({ rooms }) => rooms.includes('user:student-sos')));
  assert.ok(sosEvents.every(({ rooms }) => !rooms.includes('role:security')));
  assert.deepEqual(notificationRecipients, ['admin-1']);
});
