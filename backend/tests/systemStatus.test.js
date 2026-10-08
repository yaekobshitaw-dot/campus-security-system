const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'system-status-test-secret';

const { SecuritySession, SystemSetting, User } = require('../src/models');
const { isSystemActive } = require('../src/services/settingsService');
const { authenticate } = require('../src/middleware/auth');
const { initSocket } = require('../src/config/socket');
const systemRoutes = require('../src/routes/systemRoutes');
const app = require('../src/app');

const originalFindByPkSetting = SystemSetting.findByPk;
const originalFindByPkUser = User.findByPk;
const originalSessionFindOne = SecuritySession.findOne;
test.afterEach(() => {
  SystemSetting.findByPk = originalFindByPkSetting;
  User.findByPk = originalFindByPkUser;
  SecuritySession.findOne = originalSessionFindOne;
});

const response = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; },
});

const authenticateRequest = async (role) => {
  const userId = `${role}-1`;
  SecuritySession.findOne = async () => ({ session_id: 'session-1', user_id: userId, revoked_at: null, expires_at: new Date(Date.now() + 60000) });
  const token = jwt.sign({ user_id: userId, sid: 'session-1' }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = response();
  let nextCalled = false;
  await authenticate(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
};

test('system defaults to active until an explicit inactive setting is persisted', async () => {
  SystemSetting.findByPk = async () => null;
  assert.equal(await isSystemActive(), true);

  SystemSetting.findByPk = async () => ({ value: 'false' });
  assert.equal(await isSystemActive(), false);
});

test('system status endpoint exposes only the active state', async () => {
  SystemSetting.findByPk = async () => ({ value: 'false' });
  const route = systemRoutes.stack.find((layer) => layer.route?.path === '/status').route;
  const res = response();

  await route.stack[0].handle({}, res);

  assert.equal(res.statusCode, null);
  assert.deepEqual(res.payload, { success: true, data: { active: false } });
});

test('app mounts the public system status route before authenticated API routers', () => {
  const systemRouterIndex = app._router.stack.findIndex((layer) => layer.handle === systemRoutes);
  const authenticatedRouterIndex = app._router.stack.findIndex((layer) =>
    layer.regexp?.test('/api') && layer.handle.stack?.some((nestedLayer) => nestedLayer.name === 'authenticate')
  );

  assert.notEqual(systemRouterIndex, -1);
  assert.notEqual(authenticatedRouterIndex, -1);
  assert.ok(systemRouterIndex < authenticatedRouterIndex);
});

test('authentication blocks non-admin protected APIs while deactivated', async () => {
  User.findByPk = async () => ({ user_id: 'security_officer-1', role: 'security_officer', is_active: true });
  SystemSetting.findByPk = async () => ({ value: 'false' });

  const { res, nextCalled } = await authenticateRequest('security_officer');

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.code, 'SYSTEM_DEACTIVATED');
});

test('authentication preserves Admin access while deactivated', async () => {
  User.findByPk = async () => ({ user_id: 'admin-1', role: 'admin', is_active: true });
  SystemSetting.findByPk = async () => ({ value: 'false' });

  const { req, res, nextCalled } = await authenticateRequest('admin');

  assert.equal(nextCalled, true);
  assert.equal(req.user.role, 'admin');
  assert.equal(res.statusCode, null);
});

test('authentication fails closed when system availability cannot be read', async () => {
  User.findByPk = async () => ({ user_id: 'student-1', role: 'student', is_active: true });
  SystemSetting.findByPk = async () => { throw new Error('database unavailable'); };

  const { res, nextCalled } = await authenticateRequest('student');

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.code, 'SYSTEM_STATUS_UNAVAILABLE');
});

test('socket authentication blocks non-admin connections while deactivated', async () => {
  User.findByPk = async () => ({ user_id: 'student-1', role: 'student', is_active: true });
  SystemSetting.findByPk = async () => ({ value: 'false' });
  SecuritySession.findOne = async () => ({ session_id: 'session-1', user_id: 'student-1', revoked_at: null, expires_at: new Date(Date.now() + 60000) });
  const io = {
    use(handler) { this.authentication = handler; },
    on() {},
  };
  initSocket(io);
  const socket = { handshake: { auth: { token: jwt.sign({ user_id: 'student-1', sid: 'session-1' }, process.env.JWT_SECRET) } } };
  let authError;

  await io.authentication(socket, (error) => { authError = error; });

  assert.match(authError.message, /deactivated/i);
  assert.equal(socket.user, undefined);
});

test('socket authentication preserves Admin connections while deactivated', async () => {
  User.findByPk = async () => ({ user_id: 'admin-1', role: 'admin', is_active: true });
  SystemSetting.findByPk = async () => ({ value: 'false' });
  SecuritySession.findOne = async () => ({ session_id: 'session-1', user_id: 'admin-1', revoked_at: null, expires_at: new Date(Date.now() + 60000) });
  const io = {
    use(handler) { this.authentication = handler; },
    on() {},
  };
  initSocket(io);
  const socket = { handshake: { auth: { token: jwt.sign({ user_id: 'admin-1', sid: 'session-1' }, process.env.JWT_SECRET) } } };
  let authError;

  await io.authentication(socket, (error) => { authError = error; });

  assert.equal(authError, undefined);
  assert.equal(socket.user.role, 'admin');
});
