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
  sendLomisendSms,
  getLomisendRequestBody,
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
  const previousProjectId = process.env.LOMISEND_PROJECT_ID;
  process.env.LOMISEND_API_KEY = 'test-api-key';
  process.env.LOMISEND_SENDER_ID = '';
  process.env.LOMISEND_PROJECT_ID = '01a060f7-6e88-7263-a4f8-da75c3466a70';

  __setLomisendClientForTests({
    post: async (url, payload, config) => ({
      status: 202,
      data: {
        data: {
          status: 'accepted',
          id: 'LMS-123',
          to: payload.to,
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

    if (previousProjectId === undefined) {
      delete process.env.LOMISEND_PROJECT_ID;
    } else {
      process.env.LOMISEND_PROJECT_ID = previousProjectId;
    }
  }
});

test('Lomisend request includes the project ID and omits pending sender IDs', () => {
  const request = getLomisendRequestBody({
    projectId: '01a060f7-6e88-7263-a4f8-da75c3466a70',
    to: '0976296127',
    message: 'Test message',
  });

  assert.deepEqual(request, {
    id: '01a060f7-6e88-7263-a4f8-da75c3466a70',
    to: '+251976296127',
    body: 'Test message',
  });
});

test('Lomisend request never sends YOUR_SENDER_ID', () => {
  const request = getLomisendRequestBody({
    projectId: '01a060f7-6e88-7263-a4f8-da75c3466a70',
    to: '0976296127',
    message: 'Test message',
    from: 'YOUR_SENDER_ID',
  });

  assert.equal(Object.hasOwn(request, 'sender_id'), false);
});

test('Lomisend HTTP errors preserve status and provider messages', async () => {
  const previousApiKey = process.env.LOMISEND_API_KEY;
  const previousProjectId = process.env.LOMISEND_PROJECT_ID;
  process.env.LOMISEND_API_KEY = 'test-api-key';
  process.env.LOMISEND_PROJECT_ID = '01a060f7-6e88-7263-a4f8-da75c3466a70';

  try {
    for (const [status, expected] of [
      [401, 'Lomisend API authentication error'],
      [402, 'Insufficient Lomisend balance or credits'],
      [403, 'Lomisend subscription, permission, project, or sender restriction'],
      [422, 'Invalid Lomisend request, sender, or project configuration'],
    ]) {
      __setLomisendClientForTests({
        post: async () => {
          const error = new Error('provider detail');
          error.response = { status, data: { message: 'provider detail' } };
          throw error;
        },
      });

      await assert.rejects(
        () => sendLomisendSms({ to: '0976296127', message: 'Test message' }),
        (error) => {
          assert.equal(error.statusCode, status);
          assert.match(error.message, new RegExp(expected));
          assert.match(error.message, /provider detail/);
          return true;
        },
      );
    }
  } finally {
    __resetLomisendClientForTests();

    if (previousApiKey === undefined) {
      delete process.env.LOMISEND_API_KEY;
    } else {
      process.env.LOMISEND_API_KEY = previousApiKey;
    }

    if (previousProjectId === undefined) {
      delete process.env.LOMISEND_PROJECT_ID;
    } else {
      process.env.LOMISEND_PROJECT_ID = previousProjectId;
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
