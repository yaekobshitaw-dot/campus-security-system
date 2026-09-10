const test = require('node:test');
const assert = require('node:assert/strict');
const incidentController = require('../src/controllers/incidentController');
const { Alert, Incident, User } = require('../src/models');

const originalIncidentCreate = Incident.create;
const originalAlertCreate = Alert.create;
const originalUserFindAll = User.findAll;

test.afterEach(() => {
  Incident.create = originalIncidentCreate;
  Alert.create = originalAlertCreate;
  User.findAll = originalUserFindAll;
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
    if (event === 'new-incident' || event === 'alert-received') {
      socket.broadcasts.push({ event, payload, rooms: [...socket.roomTargets] });
      socket.roomTargets = [];
    }
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

test('routes incident creation events to security/admin rooms and the owner only', async () => {
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
    ['role:security', 'role:admin', 'user:student-a'],
    ['role:security', 'role:admin', 'user:student-a']
  ]);
});

test('does not target another student room when a different student reports an incident', async () => {
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
});
