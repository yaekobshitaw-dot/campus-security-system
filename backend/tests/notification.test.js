const test = require('node:test');
const assert = require('node:assert/strict');
const notificationController = require('../src/controllers/notificationController');
const { AuditLog, Incident, Notification, User } = require('../src/models');
const { notifyUsers } = require('../src/services/notificationPersistence');

const originalFindAll = Notification.findAll;
const originalFindOne = Notification.findOne;
const originalFindOrCreate = Notification.findOrCreate;
const originalDestroy = Notification.destroy;
const originalUpdate = Notification.update;
const originalUserFindAll = User.findAll;
const originalAuditCreate = AuditLog.create;
const originalIncidentDestroy = Incident.destroy;

test.afterEach(() => {
  Notification.findAll = originalFindAll;
  Notification.findOne = originalFindOne;
  Notification.findOrCreate = originalFindOrCreate;
  Notification.destroy = originalDestroy;
  Notification.update = originalUpdate;
  User.findAll = originalUserFindAll;
  AuditLog.create = originalAuditCreate;
  Incident.destroy = originalIncidentDestroy;
});

const makeResponse = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; }
});

for (const [userId, expectedIndex] of [
  ['admin-a', 0],
  ['officer-a', 1],
  ['officer-b', 2],
]) {
  test(`${userId} sees only their own notifications`, async () => {
    const sample = [
      { notification_id: 'admin-n', user_id: 'admin-a', message: 'Admin update', is_read: false },
      { notification_id: 'officer-a-n', user_id: 'officer-a', message: 'Officer A assignment', is_read: false },
      { notification_id: 'officer-b-n', user_id: 'officer-b', message: 'Officer B assignment', is_read: false },
    ];

    Notification.findAll = async (options) => {
      return sample.filter((notification) => notification.user_id === options.where.user_id);
    };

    const req = { user: { user_id: userId } };
    const res = makeResponse();

    await notificationController.list(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.data, [sample[expectedIndex]]);
  });
}
test('default notifications target Admins only while explicit audiences remain supported', async () => {
  let userQuery;
  const notifiedRooms = [];
  User.findAll = async (options) => {
    userQuery = options;
    return [{ user_id: 'admin-a' }];
  };
  Notification.findOrCreate = async ({ defaults }) => [{ ...defaults, notification_id: 'admin-n', toJSON() { return this; } }, true];
  const req = { app: { get: () => ({ to: (room) => ({ emit: (_event, notification) => notifiedRooms.push({ room, notification }) }) }) } };

  await notifyUsers(req, {
    type: 'system_settings_changed',
    title: 'System settings changed',
    message: 'An administrator updated system settings.',
    dedupeKey: 'settings:test',
  });

  assert.deepEqual(userQuery.where, { is_active: true, role: 'admin' });
  assert.deepEqual(notifiedRooms.map(({ room }) => room), ['user:admin-a']);
  assert.equal(notifiedRooms[0].notification.user_id, 'admin-a');

  await notifyUsers(req, {
    type: 'officer_assignment',
    title: 'Security officer assigned',
    message: 'Officer A has been assigned to an incident.',
    dedupeKey: 'assignment:test',
  }, [{ user_id: 'officer-a' }]);

  assert.deepEqual(notifiedRooms.map(({ room }) => room), ['user:admin-a', 'user:officer-a']);
  assert.equal(notifiedRooms[1].notification.user_id, 'officer-a');
});

test('clearHistory deletes only notifications owned by the authenticated user', async () => {
  let destroyOptions;
  let incidentDestroyCalled = false;
  Notification.destroy = async (options) => {
    destroyOptions = options;
    return 2;
  };
  AuditLog.create = async () => ({});
  Incident.destroy = async () => { incidentDestroyCalled = true; };

  const req = {
    user: { user_id: 'user-a' },
    body: { user_id: 'user-b' },
    ip: '127.0.0.1',
  };
  const res = makeResponse();
  await notificationController.clearHistory(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(destroyOptions, { where: { user_id: 'user-a' } });
  assert.equal(res.payload.data.deleted_count, 2);
  assert.equal(incidentDestroyCalled, false);
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
  let query;
  Notification.findOne = async (options) => {
    query = options;
    return options.where.user_id === item.user_id ? item : null;
  };

  const req = { params: { id: 'n3' }, user: { user_id: 'user-a' }, body: {}, app: { get: () => null } };
  const res = makeResponse();
  await notificationController.markRead(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(query.where, { notification_id: 'n3', user_id: 'user-a' });
  assert.equal(item.is_read, true);
});

test('markRead cannot update an Admin or another Officer notification', async (t) => {
  const notifications = [
    { notification_id: 'admin-n', user_id: 'admin-a' },
    { notification_id: 'officer-a-n', user_id: 'officer-a' },
  ];
  Notification.findOne = async ({ where }) => notifications.find((item) => (
    item.notification_id === where.notification_id && item.user_id === where.user_id
  )) || null;

  for (const [userId, notificationId] of [['officer-b', 'officer-a-n'], ['officer-a', 'admin-n']]) {
    await t.test(`${userId} cannot mark ${notificationId} as read`, async () => {
      const res = makeResponse();
      await notificationController.markRead({ params: { id: notificationId }, user: { user_id: userId } }, res);
      assert.equal(res.statusCode, 404);
    });
  }
});

test('markAllRead updates only the authenticated user unread notifications', async () => {
  let query;
  Notification.update = async (_values, options) => {
    query = options;
    return [1];
  };
  AuditLog.create = async () => ({});
  const res = makeResponse();
  await notificationController.markAllRead({ user: { user_id: 'officer-a' }, ip: '127.0.0.1' }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(query.where, { user_id: 'officer-a', is_read: false });
});



