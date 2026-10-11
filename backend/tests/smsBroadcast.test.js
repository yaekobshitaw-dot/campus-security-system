const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBroadcastPayload } = require('../src/utils/smsValidation');
const { User, SmsMessage } = require('../src/models');

const smsServicePath = require.resolve('../src/services/smsService');
const controllerPath = require.resolve('../src/controllers/smsController');
const originalSmsService = require.cache[smsServicePath];

const makeResponse = () => ({
  statusCode: null,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

test('broadcast validation requires recipients, safe message, and idempotency key', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000';
  assert.deepEqual(validateBroadcastPayload({ recipientUserIds: [id, id], message: '  Campus notice  ', idempotencyKey: 'broadcast-key-123456' }), {
    recipientUserIds: [id],
    message: 'Campus notice',
    idempotencyKey: 'broadcast-key-123456',
  });
  assert.throws(() => validateBroadcastPayload({ recipientUserIds: [], message: 'Notice', idempotencyKey: 'broadcast-key-123456' }), /recipient/i);
  assert.throws(() => validateBroadcastPayload({ recipientUserIds: [id], message: 'Notice', idempotencyKey: 'short' }), /idempotency/i);
});

test('admin broadcast returns prior records for a repeated idempotency key', async () => {
  const recipientId = '123e4567-e89b-12d3-a456-426614174000';
  const adminId = '223e4567-e89b-12d3-a456-426614174000';
  const recipient = { user_id: recipientId, name: 'Student One', role: 'student', phone: '0976296127', is_active: true };
  const records = [];
  const original = {
    userFindAll: User.findAll,
    smsFindAll: SmsMessage.findAll,
    smsFindByPk: SmsMessage.findByPk,
    smsCreate: SmsMessage.create,
  };
  const sentSmsService = { sendSmsMessage: async () => {
    const record = {
      sms_id: '323e4567-e89b-12d3-a456-426614174000',
      recipient_user_id: recipientId,
      recipient_phone: recipient.phone,
      status: 'sent',
      provider: 'africastalking',
      error_message: null,
      created_at: new Date().toISOString(),
      recipient: { name: recipient.name, role: recipient.role },
    };
    records.push(record);
    return { sms_id: record.sms_id };
  }, assertSmsProviderConfigured: () => {} };

  require.cache[smsServicePath] = { id: smsServicePath, filename: smsServicePath, loaded: true, exports: sentSmsService };
  delete require.cache[controllerPath];
  const { broadcastSms } = require('../src/controllers/smsController');
  User.findAll = async () => [recipient];
  SmsMessage.findAll = async ({ where }) => where?.idempotency_key ? records : [];
  SmsMessage.findByPk = async () => records[0];
  SmsMessage.create = async (values) => ({ ...values, sms_id: 'failed-record', created_at: new Date().toISOString(), recipient });

  try {
    const request = { user: { user_id: adminId }, body: { recipientUserIds: [recipientId], message: 'Campus notice', idempotencyKey: 'broadcast-key-123456' } };
    const firstResponse = makeResponse();
    await broadcastSms(request, firstResponse);
    assert.equal(firstResponse.statusCode, 202);
    assert.equal(firstResponse.payload.data.successful, 1);
    assert.equal(records.length, 1);

    const secondResponse = makeResponse();
    await broadcastSms(request, secondResponse);
    assert.equal(secondResponse.statusCode, 200);
    assert.equal(secondResponse.payload.duplicate, true);
    assert.equal(records.length, 1);
  } finally {
    User.findAll = original.userFindAll;
    SmsMessage.findAll = original.smsFindAll;
    SmsMessage.findByPk = original.smsFindByPk;
    SmsMessage.create = original.smsCreate;
    if (originalSmsService) require.cache[smsServicePath] = originalSmsService;
    else delete require.cache[smsServicePath];
    delete require.cache[controllerPath];
  }
});

test('broadcast returns 503 and sends nothing when Africa\'s Talking is misconfigured', async () => {
  const adminId = '223e4567-e89b-12d3-a456-426614174000';
  const originalSmsFindAll = SmsMessage.findAll;
  let sendCount = 0;
  const configurationError = Object.assign(new Error("Africa's Talking SMS provider is not configured."), {
    code: 'SMS_PROVIDER_CONFIGURATION',
  });
  const smsService = {
    assertSmsProviderConfigured() { throw configurationError; },
    sendSmsMessage: async () => { sendCount += 1; },
  };

  require.cache[smsServicePath] = { id: smsServicePath, filename: smsServicePath, loaded: true, exports: smsService };
  delete require.cache[controllerPath];
  const { broadcastSms } = require('../src/controllers/smsController');
  SmsMessage.findAll = async () => [];

  try {
    const response = makeResponse();
    await broadcastSms({
      user: { user_id: adminId },
      body: {
        recipientUserIds: ['123e4567-e89b-12d3-a456-426614174000'],
        message: 'Campus notice',
        idempotencyKey: 'broadcast-key-123456',
      },
    }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(sendCount, 0);
  } finally {
    SmsMessage.findAll = originalSmsFindAll;
    if (originalSmsService) require.cache[smsServicePath] = originalSmsService;
    else delete require.cache[smsServicePath];
    delete require.cache[controllerPath];
  }
});

test('single SMS request returns 503 when Africa\'s Talking is misconfigured', async () => {
  const recipientId = '123e4567-e89b-12d3-a456-426614174000';
  const adminId = '223e4567-e89b-12d3-a456-426614174000';
  const originalUserFindByPk = User.findByPk;
  const configurationError = Object.assign(new Error("Africa's Talking SMS provider is not configured."), {
    code: 'SMS_PROVIDER_CONFIGURATION',
  });
  const smsService = {
    assertSmsProviderConfigured() {},
    sendSmsMessage: async () => { throw configurationError; },
  };

  require.cache[smsServicePath] = { id: smsServicePath, filename: smsServicePath, loaded: true, exports: smsService };
  delete require.cache[controllerPath];
  const { createSmsRequest } = require('../src/controllers/smsController');
  User.findByPk = async () => ({ user_id: recipientId, phone: '0976296127', is_active: true });

  try {
    const response = makeResponse();
    await createSmsRequest({
      user: { user_id: adminId, role: 'admin' },
      body: { recipientUserId: recipientId, message: 'Campus notice' },
    }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.payload.message, "Africa's Talking SMS provider is not configured.");
  } finally {
    User.findByPk = originalUserFindByPk;
    if (originalSmsService) require.cache[smsServicePath] = originalSmsService;
    else delete require.cache[smsServicePath];
    delete require.cache[controllerPath];
  }
});
