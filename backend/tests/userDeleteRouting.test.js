const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const userRoutes = require('../src/routes/userRoutes');
const { User } = require('../src/models');

const originalTransaction = User.sequelize.transaction;
const originalFindAll = User.findAll;
const originalFindByPk = User.findByPk;

test.afterEach(() => {
  User.sequelize.transaction = originalTransaction;
  User.findAll = originalFindAll;
  User.findByPk = originalFindByPk;
});

test('DELETE /api/users/:userId is mounted once on the users router', () => {
  const mountedUsersRouter = app._router.stack.some((layer) => layer.handle === userRoutes);
  const deleteRoutes = userRoutes.stack.filter((layer) => (
    layer.route?.path === '/:userId' && layer.route.methods.delete
  ));

  assert.equal(mountedUsersRouter, true);
  assert.equal(deleteRoutes.length, 1);
});

test('user deletion route keeps its Admin authorization middleware', () => {
  const deleteRoute = userRoutes.stack.find((layer) => (
    layer.route?.path === '/:userId' && layer.route.methods.delete
  )).route;
  const authorizeAdmin = deleteRoute.stack[0].handle;
  const response = {
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    json() {}
  };
  let nextCalled = false;

  authorizeAdmin({ user: { role: 'student' } }, response, () => { nextCalled = true; });

  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('bulk deletion route is registered before the single-user route and requires Admin authorization', () => {
  const bulkRouteIndex = userRoutes.stack.findIndex((layer) => (
    layer.route?.path === '/bulk' && layer.route.methods.delete
  ));
  const singleRouteIndex = userRoutes.stack.findIndex((layer) => (
    layer.route?.path === '/:userId' && layer.route.methods.delete
  ));
  const bulkRoute = userRoutes.stack[bulkRouteIndex].route;
  const response = {
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    json() {}
  };
  let nextCalled = false;

  bulkRoute.stack[0].handle({ user: { role: 'student' } }, response, () => { nextCalled = true; });

  assert.ok(bulkRouteIndex >= 0);
  assert.ok(singleRouteIndex >= 0);
  assert.ok(bulkRouteIndex < singleRouteIndex);
  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('bulk deletion validates every user ID before starting any deletion', async () => {
  let transactionStarted = false;
  User.sequelize.transaction = async () => { transactionStarted = true; };
  const bulkRoute = userRoutes.stack.find((layer) => (
    layer.route?.path === '/bulk' && layer.route.methods.delete
  )).route;
  const handler = bulkRoute.stack[bulkRoute.stack.length - 1].handle;
  const response = {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; }
  };

  await handler({
    body: { userIds: ['35b44933-bd77-4b90-a562-64f0c72a81ca', 'invalid-id'] },
    user: { user_id: 'admin-actor', role: 'admin' }
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.success, false);
  assert.equal(transactionStarted, false);
});

test('bulk deletion cannot remove the last active Admin account', async () => {
  const adminId = '35b44933-bd77-4b90-a562-64f0c72a81ca';
  let destroyCalled = false;
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  User.sequelize.transaction = async (callback) => callback(transaction);
  User.findAll = async () => [{ user_id: adminId, role: 'admin', is_active: true }];
  User.findByPk = async () => ({
    user_id: adminId,
    role: 'admin',
    name: 'Only Admin',
    destroy: async () => { destroyCalled = true; }
  });

  const bulkRoute = userRoutes.stack.find((layer) => (
    layer.route?.path === '/bulk' && layer.route.methods.delete
  )).route;
  const handler = bulkRoute.stack[bulkRoute.stack.length - 1].handle;
  const response = {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; }
  };

  await handler({
    body: { userIds: [adminId] },
    user: { user_id: 'admin-actor', role: 'admin' }
  }, response);

  assert.equal(response.statusCode, 207);
  assert.equal(response.payload.success, false);
  assert.deepEqual(response.payload.data.deleted, []);
  assert.equal(response.payload.data.failures[0].message, 'At least one active Admin account must remain.');
  assert.equal(destroyCalled, false);
});
