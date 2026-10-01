const test = require('node:test');
const assert = require('node:assert/strict');
const { authorize } = require('../src/middleware/auth');
const controller = require('../src/controllers/contactInformationController');
const { PublicContent, DEFAULT_PUBLIC_CONTENT } = require('../src/models/PublicContent');
const auditService = require('../src/services/auditService');
const notificationPersistence = require('../src/services/notificationPersistence');
const { validateContactInformationPayload } = require('../src/validators/publicContentValidator');

const original = {
  findOrCreate: PublicContent.findOrCreate,
  findOne: PublicContent.findOne,
  recordAudit: auditService.recordAudit,
  notifyUsers: notificationPersistence.notifyUsers,
};

const response = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; },
});

const contact = {
  content_id: 'contact-record',
  type: 'emergency_contact',
  title: 'Contact Us Information',
  phone: '0976296127',
  email: 'yaekobshitaw@gmail.com',
  summary: 'Tuluawulia',
  is_active: true,
  async update(values) { Object.assign(this, values); return this; },
};

test.beforeEach(() => {
  PublicContent.findOrCreate = async ({ defaults }) => [defaults.title === contact.title ? contact : {}, false];
  PublicContent.findOne = async () => contact;
  auditService.recordAudit = async () => null;
  notificationPersistence.notifyUsers = async () => [];
  Object.assign(contact, {
    phone: '0976296127',
    email: 'yaekobshitaw@gmail.com',
    summary: 'Tuluawulia',
    is_active: true,
  });
});

test.afterEach(() => {
  Object.assign(PublicContent, { findOrCreate: original.findOrCreate, findOne: original.findOne });
  auditService.recordAudit = original.recordAudit;
  notificationPersistence.notifyUsers = original.notifyUsers;
});

test('loads the persisted public Contact Us information', async () => {
  const res = response();
  await controller.getPublicContactInformation({}, res);
  assert.equal(res.statusCode, null);
  assert.deepEqual(res.payload.data, {
    phone: '0976296127',
    email: 'yaekobshitaw@gmail.com',
    location: 'Tuluawulia',
  });
  assert.ok(DEFAULT_PUBLIC_CONTENT.some((item) => item.title === 'Contact Us Information'
    && item.phone === '0976296127'
    && item.email === 'yaekobshitaw@gmail.com'
    && item.summary === 'Tuluawulia'));
});

for (const field of ['phone', 'email', 'location']) {
  test(`administrator can update Contact Us ${field}`, async () => {
    const values = {
      phone: '0976296127',
      email: 'yaekobshitaw@gmail.com',
      location: 'Tuluawulia',
      [field]: field === 'phone' ? '+251 976 296 127'
        : field === 'email' ? 'updated@example.com'
          : 'Updated campus location',
    };
    const res = response();
    await controller.updateContactInformation({ body: values, user: { user_id: 'admin-1' } }, res);
    assert.equal(res.statusCode, null);
    assert.equal(res.payload.data[field], values[field].trim());
  });
}

test('contact information validation trims and accepts a valid phone and email', () => {
  assert.deepEqual(validateContactInformationPayload({
    phone: ' 0976296127 ',
    email: ' contact@example.com ',
    location: ' Tuluawulia ',
  }), {
    phone: '0976296127',
    email: 'contact@example.com',
    location: 'Tuluawulia',
  });
});

test('rejects invalid contact email and empty required fields', async () => {
  assert.throws(() => validateContactInformationPayload({
    phone: '0976296127',
    email: 'invalid',
    location: 'Tuluawulia',
  }), /email must be valid/);
  for (const field of ['phone', 'email', 'location']) {
    assert.throws(() => validateContactInformationPayload({
      phone: '0976296127',
      email: 'contact@example.com',
      location: 'Tuluawulia',
      [field]: ' ',
    }), new RegExp(`${field} is required`));
  }
  const res = response();
  await controller.updateContactInformation({
    body: { phone: '0976296127', email: 'bad-email', location: 'Tuluawulia' },
    user: { user_id: 'admin-1' },
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /email must be valid/);
});

test('unauthorized users cannot reach administrator contact update actions', () => {
  const res = response();
  let nextCalled = false;
  authorize('admin')({ user: { role: 'student' } }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});
