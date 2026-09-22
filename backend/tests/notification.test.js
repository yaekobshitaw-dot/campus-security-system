const test = require('node:test');
const assert = require('node:assert/strict');
const notificationController = require('../src/controllers/notificationController');
const { Notification } = require('../src/models');

const originalFindAll = Notification.findAll;
const originalFindOne = Notification.findOne;

test.afterEach(() => {
  Notification.findAll = originalFindAll;
  Notification.findOne = originalFindOne;
});

const makeResponse = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; }
});

test('list returns only current user notifications', async () => {
  const sample = [{ notification_id: 'n1', user_id: 'user-a', message: 'hello', is_read: false }];
  Notification.findAll = async (opts) => sample.filter((s) => s.user_id === opts.where.user_id);

  const req = { user: { user_id: 'user-a' } };
  const res = makeResponse();
  await notificationController.list(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.data, sample);
});

test('markRead returns 404 when notification not found or belongs to another user', async () => {
  Notification.findOne = async () => null;
  const req = { params: { id: 'n2' }, user: { user_id: 'user-a' }, body: {} };
  const res = makeResponse();
  await notificationController.markRead(req, res);
  assert.equal(res.statusCode, 404);
});

test('markRead updates the notification when owned by user', async () => {
  const item = {
    notification_id: 'n3',
    user_id: 'user-a',
    is_read: false,
    update: async function (u) { Object.assign(this, u); return this; }
  };
  Notification.findOne = async () => item;

  const req = { params: { id: 'n3' }, user: { user_id: 'user-a' }, body: {}, app: { get: () => null } };
  const res = makeResponse();
  await notificationController.markRead(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(item.is_read, true);
});
