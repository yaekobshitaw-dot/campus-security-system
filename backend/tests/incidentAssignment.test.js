const test = require('node:test');
const assert = require('node:assert/strict');
const { authorize } = require('../src/middleware/auth');
const incidentController = require('../src/controllers/incidentController');
const { Incident, Response, User } = require('../src/models');
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
const originalUserFindOne = User.findOne;
const originalUserUpdate = User.update;

test.afterEach(() => {
  Incident.findByPk = originalIncidentFindByPk;
  Response.findOne = originalResponseFindOne;
  Response.create = originalResponseCreate;
  User.findOne = originalUserFindOne;
  User.update = originalUserUpdate;
});

test('assigns an active available security officer and returns the responder', async () => {
  const incident = makeIncident();
  const officer = { user_id: officerId, name: 'Officer Test', role: 'security', availability_status: 'available', latitude: null, longitude: null, async update(values) { Object.assign(this, values); } };
  Incident.findByPk = async () => incident;
  Response.findOne = async () => null;
  User.findOne = async () => officer;
  Response.create = async () => ({ response_id: 'response-1', responder_id: officer.user_id, toJSON() { return { response_id: this.response_id, responder_id: this.responder_id, status: 'assigned' }; } });

  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: incident.incident_id }, body: { officer_id: officer.user_id }, user: { user_id: '33333333-3333-4333-8333-333333333333', role: 'admin' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.data.responses[0].responder.name, 'Officer Test');
  assert.equal(response.payload.data.status, 'dispatched');
  assert.equal(officer.availability_status, 'responding');
});

test('rejects an invalid, inactive, or non-security officer', async () => {
  const incident = makeIncident();
  Incident.findByPk = async () => incident;
  Response.findOne = async () => null;
  User.findOne = async () => null;

  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: incident.incident_id }, body: { officer_id: officerId }, user: { role: 'security' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 404);
  assert.match(response.payload.message, /security officer not found/i);
});

test('rejects an already assigned incident', async () => {
  Incident.findByPk = async () => makeIncident();
  Response.findOne = async () => ({ response_id: 'existing-response' });

  const response = makeResponse();
  await incidentController.assignIncident({ params: { incident_id: incidentId }, body: { officer_id: officerId }, user: { role: 'admin' }, app: { get: () => null } }, response);

  assert.equal(response.statusCode, 409);
  assert.match(response.payload.message, /already assigned/i);
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