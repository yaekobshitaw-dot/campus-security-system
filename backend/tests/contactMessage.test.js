const test = require('node:test');
const assert = require('node:assert/strict');
const controller = require('../src/controllers/contactMessageController');
const { Notification, User } = require('../src/models');
const { validateContactMessagePayload } = require('../src/validators/publicContentValidator');

const original = {
  findAll: User.findAll,
  bulkCreate: Notification.bulkCreate,
};

const response = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; },
});

const contactMessage = {
  name: ' Alex Example ',
  email: ' alex@example.edu ',
  topic: 'campus_partnership',
  message: ' Please contact our campus team. ',
};

test.afterEach(() => {
  User.findAll = original.findAll;
  Notification.bulkCreate = original.bulkCreate;
});

test('validates and normalizes Contact Us message fields', () => {
  assert.deepEqual(validateContactMessagePayload(contactMessage), {
    name: 'Alex Example',
    email: 'alex@example.edu',
    topic: 'campus_partnership',
    message: 'Please contact our campus team.',
  });
  for (const [field, value] of Object.entries({
    name: ' ',
    email: 'not-an-email',
    topic: 'unknown',
    message: ' ',
  })) {
    assert.throws(() => validateContactMessagePayload({ ...contactMessage, [field]: value }));
  }
});

test('persists Contact Us messages as unread notifications for active admins', async () => {
  let query;
  let records;
  User.findAll = async (options) => {
    query = options;
    return [{ user_id: 'admin-1' }, { user_id: 'admin-2' }];
  };
  Notification.bulkCreate = async (items) => { records = items; };

  const res = response();
  await controller.submit({ body: contactMessage }, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(query, { where: { role: 'admin', is_active: true }, attributes: ['user_id'] });
  assert.equal(records.length, 2);
  assert.equal(records[0].type, 'contact_message');
  assert.equal(records[0].user_id, 'admin-1');
  assert.equal(records[0].data.name, 'Alex Example');
  assert.equal(records[0].data.email, 'alex@example.edu');
  assert.equal(records[0].data.topic, 'campus_partnership');
  assert.equal(records[0].data.message, 'Please contact our campus team.');
  assert.equal(records[0].is_read, undefined);
  assert.equal(records[0].resource_id, records[1].resource_id);
  assert.notEqual(records[0].dedupe_key, records[1].dedupe_key);
});

test('rejects invalid submissions without attempting persistence', async () => {
  let lookupCalled = false;
  User.findAll = async () => { lookupCalled = true; return []; };
  const res = response();

  await controller.submit({ body: { ...contactMessage, topic: 'other' } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(lookupCalled, false);
});

test('does not report success if there are no active administrators', async () => {
  User.findAll = async () => [];
  const res = response();

  await controller.submit({ body: contactMessage }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.success, false);
});

test('returns an error when notification persistence fails', async () => {
  User.findAll = async () => [{ user_id: 'admin-1' }];
  Notification.bulkCreate = async () => { throw new Error('database unavailable'); };
  const res = response();

  await controller.submit({ body: contactMessage }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.success, false);
});
