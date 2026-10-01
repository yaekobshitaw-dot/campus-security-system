const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const incidentController = require('../src/controllers/incidentController');
const incidentRoutes = require('../src/routes/incidentRoutes');
const { Incident, IncidentHistoryClear } = require('../src/models');

const originalFindAll = Incident.findAll;
const originalDestroy = Incident.destroy;
const originalClearFindByPk = IncidentHistoryClear.findByPk;
const originalClearUpsert = IncidentHistoryClear.upsert;

test.afterEach(() => {
  Incident.findAll = originalFindAll;
  Incident.destroy = originalDestroy;
  IncidentHistoryClear.findByPk = originalClearFindByPk;
  IncidentHistoryClear.upsert = originalClearUpsert;
});

const makeResponse = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; },
});

const historyRouteMiddleware = (method) => {
  const route = incidentRoutes.stack.find((layer) => (
    layer.route?.path === '/history' && layer.route.methods[method]
  ));
  assert.ok(route, `expected ${method.toUpperCase()} /history route`);
  return route.route.stack[0].handle;
};

test('incident history routes authorize every supported user role and reject unknown roles', () => {
  const authorize = historyRouteMiddleware('delete');
  for (const role of ['student', 'faculty', 'staff', 'security', 'security_officer', 'admin']) {
    let nextCalled = false;
    authorize({ user: { role } }, makeResponse(), () => { nextCalled = true; });
    assert.equal(nextCalled, true, `${role} should be allowed`);
  }

  const response = makeResponse();
  let nextCalled = false;
  authorize({ user: { role: 'guest' } }, response, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);
});

test('clearing a non-admin history stores only the authenticated user cutoff and leaves incidents intact', async () => {
  let upserted;
  let incidentDeleteCalled = false;
  IncidentHistoryClear.upsert = async (values) => { upserted = values; };
  Incident.destroy = async () => { incidentDeleteCalled = true; };
  const response = makeResponse();

  await incidentController.clearHistory({
    user: { user_id: 'student-a', role: 'student' },
    body: { user_id: 'student-b' },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(upserted.user_id, 'student-a');
  assert.ok(upserted.cleared_at instanceof Date);
  assert.equal(incidentDeleteCalled, false);
});

test('the scoped history query excludes another user and remains cleared when queried again', async () => {
  let clearedAt;
  const now = Date.now();
  const rows = [
    { incident_id: 'old-own', user_id: 'student-a', created_at: new Date(now - 10000) },
    { incident_id: 'new-own', user_id: 'student-a', created_at: new Date(now + 10000) },
    { incident_id: 'other-user', user_id: 'student-b', created_at: new Date(now - 10000) },
  ];
  IncidentHistoryClear.upsert = async ({ user_id, cleared_at }) => {
    assert.equal(user_id, 'student-a');
    clearedAt = cleared_at;
  };
  IncidentHistoryClear.findByPk = async (userId) => userId === 'student-a' ? { cleared_at: clearedAt } : null;
  Incident.findAll = async ({ where }) => rows
    .filter((incident) => incident.user_id === where.user_id)
    .filter((incident) => !where.created_at || incident.created_at > where.created_at[Op.gt])
    .map((incident) => ({ ...incident, photos: [], toJSON() { return this; } }));

  const clearResponse = makeResponse();
  await incidentController.clearHistory({ user: { user_id: 'student-a', role: 'faculty' } }, clearResponse);
  const historyResponse = makeResponse();
  await incidentController.getHistory({ user: { user_id: 'student-a', role: 'faculty' } }, historyResponse);

  assert.equal(historyResponse.statusCode, 200);
  assert.deepEqual(historyResponse.payload.data.map((incident) => incident.incident_id), ['new-own']);
  assert.equal(rows.length, 3);
});

test('security officer history follows the existing privileged incident visibility rules', async () => {
  let query;
  IncidentHistoryClear.findByPk = async () => null;
  Incident.findAll = async (options) => { query = options; return []; };
  const response = makeResponse();

  await incidentController.getHistory({ user: { user_id: 'officer-a', role: 'security_officer' } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(query.where, {});
});

test('student incident feed used for personal analytics excludes every other reporter', async () => {
  let query;
  Incident.findAll = async (options) => { query = options; return []; };
  const response = makeResponse();

  await incidentController.getAll({ user: { user_id: 'student-a', role: 'student' } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(query.where, { user_id: 'student-a' });
});

test('Admin history listing remains system-wide', async () => {
  let query;
  Incident.findAll = async (options) => { query = options; return []; };
  const response = makeResponse();

  await incidentController.getHistory({ user: { user_id: 'admin-a', role: 'admin' } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(query.where, {});
});
