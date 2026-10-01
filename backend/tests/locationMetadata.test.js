const test = require('node:test');
const assert = require('node:assert/strict');
const incidentController = require('../src/controllers/incidentController');
const { Alert, CampusLocation, Incident, User } = require('../src/models');

const originalIncidentCreate = Incident.create;
const originalAlertCreate = Alert.create;
const originalUserFindAll = User.findAll;
const { AuditLog, SystemSetting } = require('../src/models');
const originalAuditCreate = AuditLog.create;
const originalSettingFindByPk = SystemSetting.findByPk;
const originalCampusLocationFindAll = CampusLocation.findAll;

test.afterEach(() => {
  Incident.create = originalIncidentCreate;
  Alert.create = originalAlertCreate;
  User.findAll = originalUserFindAll;
  AuditLog.create = originalAuditCreate;
  SystemSetting.findByPk = originalSettingFindByPk;
  CampusLocation.findAll = originalCampusLocationFindAll;
});

const makeResponse = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; },
});

const makeSocket = () => {
  const socket = { events: [], rooms: [] };
  socket.to = (room) => {
    socket.rooms.push(room);
    return socket;
  };
  socket.emit = (event, payload) => {
    socket.events.push({ event, payload, rooms: [...socket.rooms] });
    socket.rooms = [];
  };
  return socket;
};

const makeRequest = (body, socket = makeSocket()) => ({
  body,
  files: [],
  user: { user_id: `user-${Math.random()}`, name: 'Test user', role: 'student' },
  protocol: 'http',
  get: () => 'localhost',
  app: { get: () => socket },
});

const fakeIncident = (values) => ({
  ...values,
  incident_id: 'incident-location-test',
  created_at: new Date('2026-09-29T00:00:00.000Z'),
  toJSON() {
    return { ...this };
  },
});

const stubCreationDependencies = () => {
  Incident.create = async (values) => fakeIncident(values);
  Alert.create = async (values) => ({ ...values, toJSON() { return { ...this }; } });
  User.findAll = async () => [];
  AuditLog.create = async () => null;
  SystemSetting.findByPk = async () => null;
  CampusLocation.findAll = async () => [];
};

test('accepts and stores valid incident location metadata and includes it in realtime incident events', async () => {
  stubCreationDependencies();
  const socket = makeSocket();
  const timestamp = '2026-09-29T00:00:00.000Z';
  const response = makeResponse();
  await incidentController.create(makeRequest({
    type: 'theft',
    latitude: '10.1234567',
    longitude: '39.7654321',
    location_accuracy: '4.2',
    location_timestamp: timestamp,
  }, socket), response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.data.latitude, '10.1234567');
  assert.equal(response.payload.data.longitude, '39.7654321');
  assert.equal(response.payload.data.location_accuracy, 4.2);
  assert.equal(new Date(response.payload.data.location_timestamp).toISOString(), timestamp);
  const incidentEvent = socket.events.find(({ event }) => event === 'new-incident');
  assert.equal(incidentEvent.payload.latitude, '10.1234567');
  assert.equal(incidentEvent.payload.longitude, '39.7654321');
  assert.equal(incidentEvent.payload.location_accuracy, 4.2);
  assert.equal(new Date(incidentEvent.payload.location_timestamp).toISOString(), timestamp);
});

test('rejects invalid incident coordinates and accuracy', async () => {
  for (const [field, value, message] of [
    ['latitude', '90.1', 'Invalid latitude'],
    ['longitude', '-180.1', 'Invalid longitude'],
    ['location_accuracy', '-0.1', 'Invalid location accuracy'],
    ['location_accuracy', 'not-a-number', 'Invalid location accuracy'],
    ['location_timestamp', 'not-a-timestamp', 'Invalid location timestamp'],
  ]) {
    const response = makeResponse();
    await incidentController.create(makeRequest({ type: 'theft', [field]: value }), response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.message, message);
  }
});

test('allows existing incident API clients to omit optional location metadata', async () => {
  stubCreationDependencies();
  const response = makeResponse();
  await incidentController.create(makeRequest({ type: 'theft' }), response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.data.location_accuracy, null);
  assert.equal(response.payload.data.location_timestamp, null);
});

test('stores SOS location metadata and emits it with the existing sos_alert event', async () => {
  stubCreationDependencies();
  const socket = makeSocket();
  const timestamp = '2026-09-29T00:00:00.000Z';
  const response = makeResponse();
  await incidentController.createSOS(makeRequest({
    latitude: 10.1234567,
    longitude: 39.7654321,
    location_accuracy: 4.2,
    location_timestamp: timestamp,
  }, socket), response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.data.location_accuracy, 4.2);
  assert.equal(new Date(response.payload.data.location_timestamp).toISOString(), timestamp);
  const sosEvent = socket.events.find(({ event }) => event === 'sos_alert');
  assert.equal(sosEvent.payload.latitude, 10.1234567);
  assert.equal(sosEvent.payload.longitude, 39.7654321);
  assert.equal(sosEvent.payload.location_accuracy, 4.2);
  assert.equal(new Date(sosEvent.payload.location_timestamp).toISOString(), timestamp);
});

test('returns derived campus matches for incidents and SOS without changing their submitted location data', async () => {
  stubCreationDependencies();
  CampusLocation.findAll = async () => [{
    location_id: 'verified-campus-location',
    name: 'Mekdela Amba University',
    zone_id: null,
    latitude: 10.9854535,
    longitude: 39.2631819,
    is_active: true
  }];
  const incidentResponse = makeResponse();
  await incidentController.create(makeRequest({
    type: 'theft',
    description: 'Report text remains intact',
    severity: 'high',
    location_name: 'Near the main path',
    latitude: 10.9854535,
    longitude: 39.2631819
  }), incidentResponse);

  assert.equal(incidentResponse.statusCode, 201);
  assert.equal(incidentResponse.payload.data.campus_location_id, 'verified-campus-location');
  assert.equal(incidentResponse.payload.data.location_name, 'Near the main path');
  assert.equal(incidentResponse.payload.data.description, 'Report text remains intact');
  assert.equal(incidentResponse.payload.data.latitude, 10.9854535);
  assert.equal(incidentResponse.payload.data.longitude, 39.2631819);

  const sosResponse = makeResponse();
  await incidentController.createSOS(makeRequest({
    latitude: 10.9854535,
    longitude: 39.2631819
  }), sosResponse);

  assert.equal(sosResponse.statusCode, 201);
  assert.equal(sosResponse.payload.data.campus_location_id, 'verified-campus-location');
  assert.equal(sosResponse.payload.data.location_name, 'Current device location');
  assert.equal(sosResponse.payload.data.latitude, 10.9854535);
  assert.equal(sosResponse.payload.data.longitude, 39.2631819);
  assert.equal(sosResponse.payload.data.is_sos, true);
});

test('rejects invalid SOS coordinates and accuracy', async () => {
  for (const [field, value, message] of [
    ['latitude', 90.1, 'Invalid latitude'],
    ['longitude', -180.1, 'Invalid longitude'],
    ['location_accuracy', -1, 'Invalid location accuracy'],
    ['location_timestamp', 'not-a-timestamp', 'Invalid location timestamp'],
  ]) {
    const response = makeResponse();
    await incidentController.createSOS(makeRequest({ [field]: value }), response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.message, message);
  }
});

test('allows existing SOS clients to omit the new optional metadata', async () => {
  stubCreationDependencies();
  const response = makeResponse();
  await incidentController.createSOS(makeRequest({}), response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.data.location_accuracy, null);
  assert.equal(response.payload.data.location_timestamp, null);
});
