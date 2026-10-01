const test = require('node:test');
const assert = require('node:assert/strict');
const { authenticate, authorize } = require('../src/middleware/auth');
const incidentController = require('../src/controllers/incidentController');
const { Incident, sequelize } = require('../src/models');

const originalIncidentDestroy = Incident.destroy;
const originalTransaction = sequelize.transaction;

test.afterEach(() => {
  Incident.destroy = originalIncidentDestroy;
  sequelize.transaction = originalTransaction;
});

const makeResponse = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; },
});

test('Admin remains authorized for the existing system-wide incident history action', async () => {
  let destroyOptions;
  let committed = false;
  Incident.destroy = async (options) => {
    destroyOptions = options;
    return 3;
  };
  sequelize.transaction = async () => ({
    async commit() { committed = true; },
    async rollback() {},
  });

  const response = makeResponse();
  await incidentController.clearHistory({
    user: { user_id: 'admin-1', role: 'admin' },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(destroyOptions.where, {});
  assert.equal(response.payload.data.deleted_count, 3);
  assert.equal(committed, true);
});

test('system-wide incident history authorization remains Admin-only', () => {
  const adminResponse = makeResponse();
  let adminReachedHandler = false;
  authorize('admin')({ user: { role: 'admin' } }, adminResponse, () => { adminReachedHandler = true; });
  assert.equal(adminReachedHandler, true);

  const userResponse = makeResponse();
  let userReachedHandler = false;
  authorize('admin')({ user: { role: 'student' } }, userResponse, () => { userReachedHandler = true; });
  assert.equal(userReachedHandler, false);
  assert.equal(userResponse.statusCode, 403);
});

test('unauthenticated requests are rejected before history actions run', async () => {
  const response = makeResponse();
  let nextCalled = false;
  await authenticate({ headers: {} }, response, () => { nextCalled = true; });

  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);
});
