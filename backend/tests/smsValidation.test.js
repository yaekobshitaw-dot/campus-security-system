const test = require('node:test');
const assert = require('node:assert/strict');
const { User, SmsMessage } = require('../src/models');
const {
  normalizePhoneNumber,
  toE164,
  validatePhoneNumber,
  sanitizeSmsMessage,
  validateSmsPayload,
} = require('../src/utils/smsValidation');
const {
  sendSmsMessage,
  getSmsProviderMode,
  __setLomisendClientForTests,
  __resetLomisendClientForTests,
} = require('../src/services/smsService');

test('normalizePhoneNumber strips separators and keeps country code', () => {
  assert.equal(normalizePhoneNumber('+1 (415) 555-0101'), '+14155550101');
  assert.equal(normalizePhoneNumber('(415) 555-0101'), '4155550101');
});

test('toE164 normalizes Ethiopian mobile numbers for the gateway', () => {
  assert.equal(toE164('0976296127'), '+251976296127');
  assert.equal(toE164('+251976296127'), '+251976296127');
  assert.equal(toE164('251976296127'), '+251976296127');
});

test('validatePhoneNumber rejects invalid numbers', () => {
  assert.equal(validatePhoneNumber('abc'), false);
  assert.equal(validatePhoneNumber('+1 (415) 555-0101'), true);
});

test('sanitizeSmsMessage trims and limits length', () => {
  assert.equal(sanitizeSmsMessage('  hello world  '), 'hello world');
  assert.equal(sanitizeSmsMessage('a'.repeat(5000)).length, 1600);
});

test('validateSmsPayload rejects empty messages and invalid recipients', () => {
  assert.throws(() => validateSmsPayload({ recipientUserId: '', message: 'Hello' }));
  assert.throws(() => validateSmsPayload({ recipientUserId: '123', message: '' }));
  assert.doesNotThrow(() => validateSmsPayload({ recipientUserId: '123e4567-e89b-12d3-a456-426614174000', message: 'Hello' }));
});

test('lomisend mode is the active provider', () => {
  assert.equal(getSmsProviderMode(), 'lomisend');
});

test('sendSmsMessage accepts a valid Lomisend response', async () => {
  const previousApiKey = process.env.LOMISEND_API_KEY;
  const previousSenderId = process.env.LOMISEND_SENDER_ID;
  process.env.LOMISEND_API_KEY = 'test-api-key';
  process.env.LOMISEND_SENDER_ID = 'CampusSafe';

  __setLomisendClientForTests({
    post: async (url, payload, config) => ({
      status: 202,
      data: {
        data: {
          status: 'accepted',
          id: 'LMS-123',
          to: payload.to,
          sender_id: payload.sender_id,
          body: payload.body,
        },
      },
      config,
      url,
    }),
  });

  try {
    const email = `campussecure.dev.lomisend.${Date.now()}@example.com`;
    const user = await User.create({
      name: 'Lomisend User',
      email,
      password_hash: 'DemoPass123!',
      phone: '0976296127',
      role: 'student',
      is_active: true,
    });

    const result = await sendSmsMessage({
      senderUserId: user.user_id,
      recipientUserId: user.user_id,
      recipientPhone: '0976296127',
      message: 'Lomisend SMS test message',
    });

    assert.equal(result.provider, 'lomisend');
    assert.equal(result.status, 'sent');

    const saved = await SmsMessage.findOne({
      where: { recipient_user_id: user.user_id, message: 'Lomisend SMS test message' },
    });
    assert.ok(saved);
    assert.equal(saved.provider, 'lomisend');
    assert.equal(saved.status, 'sent');
    assert.equal(saved.provider_message_id, 'LMS-123');
  } finally {
    __resetLomisendClientForTests();

    if (previousApiKey === undefined) {
      delete process.env.LOMISEND_API_KEY;
    } else {
      process.env.LOMISEND_API_KEY = previousApiKey;
    }

    if (previousSenderId === undefined) {
      delete process.env.LOMISEND_SENDER_ID;
    } else {
      process.env.LOMISEND_SENDER_ID = previousSenderId;
    }
  }
});

test('sendSmsMessage rejects invalid recipients in Lomisend mode', async () => {
  const previousApiKey = process.env.LOMISEND_API_KEY;
  process.env.LOMISEND_API_KEY = 'test-api-key';

  try {
    await assert.rejects(
      () => sendSmsMessage({
        senderUserId: '123e4567-e89b-12d3-a456-426614174000',
        recipientUserId: '00000000-0000-0000-0000-000000000000',
        recipientPhone: '0976296127',
        message: 'No recipient',
      }),
      /Recipient user not found/i,
    );
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.LOMISEND_API_KEY;
    } else {
      process.env.LOMISEND_API_KEY = previousApiKey;
    }
  }
});
