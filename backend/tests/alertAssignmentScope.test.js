const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const alertRoutes = require('../src/routes/alertRoutes');
const { Alert, Response } = require('../src/models');

const originalAlertFindAll = Alert.findAll;
const originalAlertFindOne = Alert.findOne;
const originalResponseFindAll = Response.findAll;

test.afterEach(() => {
  Alert.findAll = originalAlertFindAll;
  Alert.findOne = originalAlertFindOne;
  Response.findAll = originalResponseFindAll;
});

const handlerFor = (method, path) => {
  const route = alertRoutes.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
  assert.ok(route, `expected ${method.toUpperCase()} ${path} route`);
  return route.route.stack[0].handle;
};

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return body; }
});

test('security officers load alerts only for incidents assigned to them', async () => {
  let query;
  Response.findAll = async () => [{ incident_id: 'assigned-incident' }];
  Alert.findAll = async (options) => { query = options; return []; };

  const res = makeResponse();
  await handlerFor('get', '/')({ user: { user_id: 'officer-1', role: 'security_officer' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(query.where.incident_id[Op.in], ['assigned-incident']);
});

test('security officers cannot mark alerts for unassigned incidents as read', async () => {
  let query;
  Response.findAll = async () => [{ incident_id: 'assigned-incident' }];
  Alert.findOne = async (options) => {
    query = options;
    return { update: async () => undefined };
  };

  const res = makeResponse();
  await handlerFor('put', '/:id/read')({
    user: { user_id: 'officer-1', role: 'security_officer' },
    params: { id: 'alert-1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(query.where.incident_id[Op.in], ['assigned-incident']);
});

test('Admin retains the existing system-wide alert history', async () => {
  let query;
  Alert.findAll = async (options) => { query = options; return []; };

  const res = makeResponse();
  await handlerFor('get', '/')({ user: { user_id: 'admin-1', role: 'admin' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(query.where, undefined);
});
