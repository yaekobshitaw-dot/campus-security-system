const test = require('node:test');
const assert = require('node:assert/strict');
const { authorize } = require('../src/middleware/auth');
const userRoutes = require('../src/routes/userRoutes');
const { User, Response } = require('../src/models');

// We'll test the handler function directly via the exported router.updateAvailabilityHandler
const updateHandler = userRoutes.updateAvailabilityHandler;

function makeResp() {
  return { statusCode: null, payload: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return payload; } };
}

test('security role user can set availability to available', async () => {
  const mockUser = { user_id: 'u1', role: 'security', async update(values) { Object.assign(this, values); }, toJSON() { return this; } };
  const req = { body: { availability_status: 'available' }, user: mockUser, app: { get: () => null } };
  const res = makeResp();
  await updateHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(mockUser.availability_status, 'available');
});

test('legacy security_officer role can set availability to offline', async () => {
  const mockUser = { user_id: 'u2', role: 'security_officer', async update(values) { Object.assign(this, values); }, toJSON() { return this; } };
  const req = { body: { availability_status: 'offline' }, user: mockUser, app: { get: () => null } };
  const res = makeResp();
  await updateHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(mockUser.availability_status, 'offline');
});

test('reject invalid availability value', async () => {
  const mockUser = { user_id: 'u3', role: 'security', async update() {}, toJSON() { return this; } };
  const req = { body: { availability_status: 'sleeping' }, user: mockUser, app: { get: () => null } };
  const res = makeResp();
  await updateHandler(req, res);
  assert.equal(res.statusCode, 400);
});

test('responding officer cannot go offline', async () => {
  const mockUser = { user_id: 'u4', role: 'security', async update() {}, toJSON() { return this; } };
  // Mock Response.findOne to simulate active responding response
  const originalFindOne = Response.findOne;
  Response.findOne = async () => ({ responder_id: mockUser.user_id, status: 'responding' });
  const req = { body: { availability_status: 'offline' }, user: mockUser, app: { get: () => null } };
  const res = makeResp();
  await updateHandler(req, res);
  assert.equal(res.statusCode, 400);
  Response.findOne = originalFindOne;
});
