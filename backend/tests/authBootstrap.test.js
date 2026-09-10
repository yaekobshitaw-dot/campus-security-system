const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const authController = require('../src/controllers/authController');
const { authorize } = require('../src/middleware/auth');
const { User } = require('../src/models');

const originalFindOne = User.findOne;
const originalCreate = User.create;

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

const makeRequest = ({ secret, body = {} } = {}) => ({
  body,
  get(headerName) {
    return headerName.toLowerCase() === 'x-admin-bootstrap-secret' ? secret : undefined;
  }
});

const makeUser = (overrides = {}) => {
  const user = {
    user_id: 'user-1',
    name: 'Test User',
    email: 'user@example.com',
    role: 'student',
    is_active: true,
    ...overrides,
    toJSON() {
      return {
        user_id: this.user_id,
        name: this.name,
        email: this.email,
        role: this.role,
        is_active: this.is_active
      };
    }
  };
  return user;
};

test.beforeEach(() => {
  process.env.ADMIN_BOOTSTRAP_SECRET = 'test-bootstrap-secret';
});

test.afterEach(() => {
  delete process.env.ADMIN_BOOTSTRAP_SECRET;
  User.findOne = originalFindOne;
  User.create = originalCreate;
});

test('rejects bootstrap without authentication secret', async () => {
  const response = makeResponse();
  await authController.setupFirstAdmin(makeRequest({ body: { name: 'Admin', email: 'admin@example.com', password: 'AdminPass123!' } }), response);

  assert.equal(response.statusCode, 403);
  assert.match(response.payload.message, /invalid bootstrap credentials/i);
});

test('rejects bootstrap when the server secret is missing', async () => {
  delete process.env.ADMIN_BOOTSTRAP_SECRET;
  const response = makeResponse();
  await authController.setupFirstAdmin(makeRequest({ secret: 'test-bootstrap-secret' }), response);

  assert.equal(response.statusCode, 503);
  assert.match(response.payload.message, /not configured/i);
});

test('rejects an invalid bootstrap secret', async () => {
  const response = makeResponse();
  await authController.setupFirstAdmin(makeRequest({
    secret: 'wrong-secret',
    body: { name: 'Admin', email: 'admin@example.com', password: 'AdminPass123!' }
  }), response);

  assert.equal(response.statusCode, 403);
  assert.match(response.payload.message, /invalid bootstrap credentials/i);
});

test('creates the first admin with a valid bootstrap secret', async () => {
  User.findOne = async () => null;
  User.create = async (attributes) => makeUser({ ...attributes, user_id: 'admin-1' });
  const response = makeResponse();

  await authController.setupFirstAdmin(makeRequest({
    secret: 'test-bootstrap-secret',
    body: { name: 'First Admin', email: 'admin@example.com', password: 'AdminPass123!' }
  }), response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.data.user.role, 'admin');
  assert.equal(response.payload.data.user.email, 'admin@example.com');
});

test('rejects bootstrap after an admin already exists', async () => {
  User.findOne = async () => makeUser({ role: 'admin' });
  const response = makeResponse();

  await authController.setupFirstAdmin(makeRequest({
    secret: 'test-bootstrap-secret',
    body: { name: 'Second Admin', email: 'second-admin@example.com', password: 'AdminPass123!' }
  }), response);

  assert.equal(response.statusCode, 409);
  assert.match(response.payload.message, /already exists/i);
});

test('normal login remains available', async () => {
  const user = makeUser({ email: 'admin@example.com', role: 'admin' });
  user.comparePassword = async (password) => password === 'AdminPass123!';
  User.findOne = async () => user;
  const response = makeResponse();

  await authController.login({ body: { email: 'ADMIN@example.com', password: 'AdminPass123!' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.data.user.role, 'admin');
  assert.ok(response.payload.data.accessToken);
});

test('existing admin authorization remains enforced', () => {
  const deniedResponse = makeResponse();
  let nextCalled = false;
  authorize('admin')({ user: { role: 'student' } }, deniedResponse, () => { nextCalled = true; });

  assert.equal(deniedResponse.statusCode, 403);
  assert.equal(nextCalled, false);

  const allowedResponse = makeResponse();
  authorize('admin')({ user: { role: 'admin' } }, allowedResponse, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(allowedResponse.statusCode, null);
});
