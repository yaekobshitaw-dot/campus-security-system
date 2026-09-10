const test = require('node:test');
const assert = require('node:assert/strict');
const userRoutes = require('../src/routes/userRoutes');
const { Response, User } = require('../src/models');
const { authorize } = require('../src/middleware/auth');

const originalUserFindAll = User.findAll;
const originalResponseFindAll = Response.findAll;
const securityOfficerHandler = userRoutes.stack
  .find((layer) => layer.route?.path === '/security-officers')
  .route.stack.at(-1).handle;
const locationHandler = userRoutes.stack
  .find((layer) => layer.route?.path === '/me/location')
  .route.stack.at(-1).handle;

const makeResponse = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; }
});

const officer = (overrides = {}) => {
  const value = {
    user_id: 'officer-1',
    name: 'Officer Test',
    role: 'security',
    latitude: 9.02,
    longitude: 38.75,
    availability_status: 'available',
    location_updated_at: new Date(),
    ...overrides
  };
  return { ...value, toJSON: () => ({ ...value }) };
};

test.afterEach(() => {
  User.findAll = originalUserFindAll;
  Response.findAll = originalResponseFindAll;
});

test('returns active security officers with live and responding state', async () => {
  User.findAll = async () => [officer()];
  Response.findAll = async () => [{ responder_id: 'officer-1' }];
  const response = makeResponse();

  await securityOfficerHandler({ user: { role: 'admin' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.data[0].availability_status, 'responding');
  assert.equal(response.payload.data[0].location_status, 'live');
});

test('returns offline and unavailable for an officer without valid location', async () => {
  User.findAll = async () => [officer({ latitude: null, longitude: null, availability_status: 'available', location_updated_at: null })];
  Response.findAll = async () => [];
  const response = makeResponse();

  await securityOfficerHandler({ user: { role: 'security' } }, response);

  assert.equal(response.payload.data[0].availability_status, 'offline');
  assert.equal(response.payload.data[0].location_status, 'unavailable');
});

test('marks stale valid coordinates as last known and makes available officer offline', async () => {
  User.findAll = async () => [officer({ location_updated_at: new Date(Date.now() - 10 * 60 * 1000) })];
  Response.findAll = async () => [];
  const response = makeResponse();

  await securityOfficerHandler({ user: { role: 'admin' } }, response);

  assert.equal(response.payload.data[0].availability_status, 'offline');
  assert.equal(response.payload.data[0].location_status, 'last_known');
  assert.equal(response.payload.data[0].location_is_stale, true);
});

test('rejects invalid coordinates from being shown as current', async () => {
  User.findAll = async () => [officer({ latitude: 999, longitude: 38.75 })];
  Response.findAll = async () => [];
  const response = makeResponse();

  await securityOfficerHandler({ user: { role: 'admin' } }, response);

  assert.equal(response.payload.data[0].availability_status, 'offline');
  assert.equal(response.payload.data[0].location_status, 'unavailable');
});

test('does not mark an officer responding after the incident is resolved', async () => {
  User.findAll = async () => [officer()];
  Response.findAll = async () => [];
  const response = makeResponse();

  await securityOfficerHandler({ user: { role: 'admin' } }, response);

  assert.equal(response.payload.data[0].availability_status, 'available');
});

test('requires security or admin authorization for officer operations', () => {
  const response = makeResponse();
  let nextCalled = false;
  authorize('security', 'admin')({ user: { role: 'student' } }, response, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);
});

test('rejects invalid GPS coordinates and persists a valid update for the second security officer', async () => {
  const invalidResponse = makeResponse();
  await locationHandler({ body: { latitude: 91, longitude: 38.75 }, user: { availability_status: 'responding' } }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);

  const user = {
    user_id: 'officer-1',
    name: 'secureOffline',
    role: 'security',
    availability_status: 'responding',
    latitude: null,
    longitude: null,
    location_updated_at: null,
    async update(values) { Object.assign(this, values); }
  };
  const validResponse = makeResponse();
  await locationHandler({ body: { latitude: 9.02, longitude: 38.75 }, user, app: { get: () => null } }, validResponse);
  assert.equal(validResponse.statusCode, 200);
  assert.equal(validResponse.payload.data.availability_status, 'responding');
  assert.equal(validResponse.payload.data.latitude, 9.02);
});
