const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const zoneRoutes = require('../src/routes/zoneRoutes');
const campusLocationRoutes = require('../src/routes/campusLocationRoutes');
const alertRoutes = require('../src/routes/alertRoutes');
const userRoutes = require('../src/routes/userRoutes');
const { Alert, Response, User } = require('../src/models');
const { getAdminSmsRecipients } = require('../src/controllers/smsController');

const originalAlertFindAll = Alert.findAll;
const originalAlertFindOne = Alert.findOne;
const originalUserFindAll = User.findAll;
const originalResponseFindAll = Response.findAll;

test.afterEach(() => {
  Alert.findAll = originalAlertFindAll;
  Alert.findOne = originalAlertFindOne;
  User.findAll = originalUserFindAll;
  Response.findAll = originalResponseFindAll;
});

const response = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; }
});

const authorizationFor = (router, method, routePath) => {
  const routeLayer = router.stack.find((layer) => (
    layer.route?.path === routePath && layer.route.methods[method]
  ));
  assert.ok(routeLayer, `expected ${method.toUpperCase()} ${routePath} route`);
  return routeLayer.route.stack[0].handle;
};

const isAllowed = (middleware, role) => {
  const res = response();
  let nextCalled = false;
  middleware({ user: { role } }, res, () => { nextCalled = true; });
  return { allowed: nextCalled, response: res };
};

test('only admins can create, update, or delete zones', () => {
  for (const [method, routePath] of [
    ['post', '/'],
    ['put', '/:id'],
    ['patch', '/:id'],
    ['delete', '/:id'],
  ]) {
    const authorize = authorizationFor(zoneRoutes, method, routePath);
    assert.equal(isAllowed(authorize, 'admin').allowed, true);
    assert.equal(isAllowed(authorize, 'security_officer').response.statusCode, 403);
    assert.equal(isAllowed(authorize, 'security').response.statusCode, 403);
    assert.equal(isAllowed(authorize, 'student').response.statusCode, 403);
  }
});

test('security_officer can read campus locations but cannot manage them', () => {
  for (const routePath of ['/', '/:id']) {
    const result = isAllowed(authorizationFor(campusLocationRoutes, 'get', routePath), 'security_officer');
    assert.equal(result.allowed, true);
  }

  for (const [method, routePath] of [
    ['post', '/'],
    ['put', '/:id'],
    ['patch', '/:id'],
    ['delete', '/:id'],
  ]) {
    const result = isAllowed(authorizationFor(campusLocationRoutes, method, routePath), 'security_officer');
    assert.equal(result.allowed, false);
    assert.equal(result.response.statusCode, 403);
  }
});

test('security_officer alert requests are limited to assigned incidents', async () => {
  let queryOptions;
  Response.findAll = async () => [{ incident_id: 'assigned-incident' }];
  Alert.findAll = async (options) => { queryOptions = options; return []; };
  const route = alertRoutes.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.get).route;
  const res = response();

  await route.stack[0].handle({ user: { user_id: 'officer-1', role: ' SECURITY_OFFICER ' } }, res);

  assert.equal(res.statusCode, null);
  assert.equal(queryOptions.include[0].where, undefined);
  assert.deepEqual(queryOptions.where.incident_id[Op.in], ['assigned-incident']);
});

test('security_officer can load the security-officer list but students cannot', () => {
  const result = isAllowed(authorizationFor(userRoutes, 'get', '/security-officers'), 'security_officer');
  assert.equal(result.allowed, true);
  assert.equal(isAllowed(authorizationFor(userRoutes, 'get', '/security-officers'), 'student').response.statusCode, 403);
});

test('admin SMS recipient filters support every application role, including security_officer', async () => {
  const supportedRoles = ['student', 'faculty', 'staff', 'security', 'security_officer', 'admin'];
  let queryOptions;
  User.findAll = async (options) => { queryOptions = options; return []; };

  for (const role of ['all', 'security_officer']) {
    const res = response();
    await getAdminSmsRecipients({ query: { role } }, res);
    assert.equal(res.statusCode, 200);
    if (role === 'all') assert.deepEqual(queryOptions.where.role, supportedRoles);
    else assert.deepEqual(queryOptions.where.role, ['security_officer']);
  }
});

test('MySQL bootstrap schema supports all user-model roles', () => {
  const { User } = require('../src/models');
  const modelRoles = User.rawAttributes.role.type.values;
  const schema = fs.readFileSync(
    path.resolve(__dirname, '../../docker/mysql/init.sql'),
    'utf8',
  );
  const schemaRoleEnum = schema.match(/role ENUM\(([^)]+)\)/)?.[1];

  assert.deepEqual(modelRoles, ['student', 'faculty', 'staff', 'security', 'security_officer', 'admin']);
  assert.ok(schemaRoleEnum);
  for (const role of modelRoles) {
    assert.ok(schemaRoleEnum.includes(`'${role}'`), `bootstrap schema is missing ${role}`);
  }
});
