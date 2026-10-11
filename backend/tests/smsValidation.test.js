const test = require('node:test');
const assert = require('node:assert/strict');
const { User, SmsMessage } = require('../src/models');
const { logger } = require('../src/utils/logger');
const {
    normalizePhoneNumber,
    toE164,
    validatePhoneNumber,
    sanitizeSmsMessage,
    validateSmsPayload,
} = require('../src/utils/smsValidation');
const {
    sendSmsMessage,
    sendAfricaTalkingSms,
    getAfricaTalkingRequestBody,
    getSmsProvider,
    assertSmsProviderConfigured,
    SMS_CONFIGURATION_ERROR_CODE,
    SmsProviderConfigurationError,
    __setAfricaTalkingClientForTests,
    __resetAfricaTalkingClientForTests,
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

test('Africa\'s Talking is the only selectable SMS provider', () => {
    const previousProvider = process.env.SMS_PROVIDER;
    process.env.SMS_PROVIDER = 'africastalking';
    try {
        assert.equal(getSmsProvider().name, 'africastalking');
        assert.equal(getSmsProvider().send, sendAfricaTalkingSms);
        process.env.SMS_PROVIDER = 'other';
        assert.throws(() => getSmsProvider(), { code: SMS_CONFIGURATION_ERROR_CODE });
    } finally {
        if (previousProvider === undefined) delete process.env.SMS_PROVIDER;
        else process.env.SMS_PROVIDER = previousProvider;
    }
});

test('Africa\'s Talking Sandbox request uses the documented encoded fields and optional sender ID', () => {
    const request = getAfricaTalkingRequestBody({
        to: '0976296127',
        message: 'Test & verify',
        username: 'sandbox',
    });
    assert.equal(request.toString(), 'username=sandbox&to=%2B251976296127&message=Test+%26+verify');

    request.set('from', 'Campus Test');
    assert.equal(request.toString(), 'username=sandbox&to=%2B251976296127&message=Test+%26+verify&from=Campus+Test');
});

test('Africa\'s Talking Sandbox sends the required endpoint, headers, and form-encoded request', async() => {
    const previousApiKey = process.env.AFRICASTALKING_API_KEY;
    const previousUsername = process.env.AFRICASTALKING_USERNAME;
    const previousEnvironment = process.env.AFRICASTALKING_ENVIRONMENT;
    const previousSenderId = process.env.AFRICASTALKING_SENDER_ID;
    const previousTimeout = process.env.AFRICASTALKING_TIMEOUT_MS;
    process.env.AFRICASTALKING_API_KEY = 'sandbox-mock-api-key';
    process.env.AFRICASTALKING_USERNAME = 'sandbox';
    process.env.AFRICASTALKING_ENVIRONMENT = 'sandbox';
    process.env.AFRICASTALKING_SENDER_ID = '';
    process.env.AFRICASTALKING_TIMEOUT_MS = '12345';

    try {
        __setAfricaTalkingClientForTests({
            post: async(url, body, config) => {
                assert.equal(url, 'https://api.sandbox.africastalking.com/version1/messaging');
                assert.equal(body, 'username=sandbox&to=%2B251911234567&message=Mocked+SMS');
                assert.equal(config.headers['Content-Type'], 'application/x-www-form-urlencoded');
                assert.equal(config.headers.Accept, 'application/json');
                assert.equal(config.headers.apiKey, 'sandbox-mock-api-key');
                assert.equal(config.timeout, 12345);
                return {
                    status: 201,
                    data: {
                        SMSMessageData: {
                            Recipients: [{ statusCode: 102, messageId: 'ATX-123' }],
                        },
                    },
                };
            },
        });

        const result = await sendAfricaTalkingSms({ to: '+251911234567', message: 'Mocked SMS' });
        assert.equal(result.provider, 'africastalking');
        assert.equal(result.status, 'queued');
        assert.equal(result.messageId, 'ATX-123');
    } finally {
        __resetAfricaTalkingClientForTests();
        if (previousApiKey === undefined) delete process.env.AFRICASTALKING_API_KEY;
        else process.env.AFRICASTALKING_API_KEY = previousApiKey;
        if (previousUsername === undefined) delete process.env.AFRICASTALKING_USERNAME;
        else process.env.AFRICASTALKING_USERNAME = previousUsername;
        if (previousEnvironment === undefined) delete process.env.AFRICASTALKING_ENVIRONMENT;
        else process.env.AFRICASTALKING_ENVIRONMENT = previousEnvironment;
        if (previousSenderId === undefined) delete process.env.AFRICASTALKING_SENDER_ID;
        else process.env.AFRICASTALKING_SENDER_ID = previousSenderId;
        if (previousTimeout === undefined) delete process.env.AFRICASTALKING_TIMEOUT_MS;
        else process.env.AFRICASTALKING_TIMEOUT_MS = previousTimeout;
    }
});

test('Africa\'s Talking Sandbox includes a configured sender ID only when present', async() => {
    const previousApiKey = process.env.AFRICASTALKING_API_KEY;
    const previousUsername = process.env.AFRICASTALKING_USERNAME;
    const previousEnvironment = process.env.AFRICASTALKING_ENVIRONMENT;
    const previousSenderId = process.env.AFRICASTALKING_SENDER_ID;
    process.env.AFRICASTALKING_API_KEY = 'sandbox-mock-api-key';
    process.env.AFRICASTALKING_USERNAME = 'sandbox';
    process.env.AFRICASTALKING_ENVIRONMENT = 'sandbox';
    process.env.AFRICASTALKING_SENDER_ID = 'CampusTest';

    try {
        __setAfricaTalkingClientForTests({
            post: async(_url, body) => {
                assert.equal(body, 'username=sandbox&to=%2B251911234567&message=Mocked+SMS&from=CampusTest');
                return { status: 201, data: { SMSMessageData: { Recipients: [{ statusCode: 101 }] } } };
            },
        });
        const result = await sendAfricaTalkingSms({ to: '+251911234567', message: 'Mocked SMS' });
        assert.equal(result.status, 'sent');
        assert.equal(result.messageId, null);
    } finally {
        __resetAfricaTalkingClientForTests();
        if (previousApiKey === undefined) delete process.env.AFRICASTALKING_API_KEY;
        else process.env.AFRICASTALKING_API_KEY = previousApiKey;
        if (previousUsername === undefined) delete process.env.AFRICASTALKING_USERNAME;
        else process.env.AFRICASTALKING_USERNAME = previousUsername;
        if (previousEnvironment === undefined) delete process.env.AFRICASTALKING_ENVIRONMENT;
        else process.env.AFRICASTALKING_ENVIRONMENT = previousEnvironment;
        if (previousSenderId === undefined) delete process.env.AFRICASTALKING_SENDER_ID;
        else process.env.AFRICASTALKING_SENDER_ID = previousSenderId;
    }
});

test('sendSmsMessage preserves queued persistence and provider message ID for Africa\'s Talking', async() => {
    const previousProvider = process.env.SMS_PROVIDER;
    const previousApiKey = process.env.AFRICASTALKING_API_KEY;
    const previousUsername = process.env.AFRICASTALKING_USERNAME;
    const previousEnvironment = process.env.AFRICASTALKING_ENVIRONMENT;
    const previousSenderId = process.env.AFRICASTALKING_SENDER_ID;
    const originalFindByPk = User.findByPk;
    const originalCreate = SmsMessage.create;
    const recipient = {
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Sandbox Recipient',
        phone: '0976296127',
    };
    let savedRecord;
    process.env.SMS_PROVIDER = 'africastalking';
    process.env.AFRICASTALKING_API_KEY = 'sandbox-mock-api-key';
    process.env.AFRICASTALKING_USERNAME = 'sandbox';
    process.env.AFRICASTALKING_ENVIRONMENT = 'sandbox';
    process.env.AFRICASTALKING_SENDER_ID = '';
    User.findByPk = async() => recipient;
    SmsMessage.create = async(values) => {
        savedRecord = {
            sms_id: '323e4567-e89b-12d3-a456-426614174000',
            ...values,
            update: async(changes) => Object.assign(savedRecord, changes),
        };
        return savedRecord;
    };
    __setAfricaTalkingClientForTests({
        post: async() => ({
            status: 201,
            data: { SMSMessageData: { Recipients: [{ statusCode: 102, messageId: 'ATX-queued-123' }] } },
        }),
    });

    try {
        const result = await sendSmsMessage({
            senderUserId: '223e4567-e89b-12d3-a456-426614174000',
            recipientUserId: recipient.user_id,
            message: 'Sandbox queued test',
        });
        assert.equal(result.provider, 'africastalking');
        assert.equal(result.status, 'queued');
        assert.match(result.message, /SMS accepted by Africa's Talking and queued/);
        assert.equal(savedRecord.provider, 'africastalking');
        assert.equal(savedRecord.status, 'queued');
        assert.equal(savedRecord.provider_message_id, 'ATX-queued-123');
    } finally {
        User.findByPk = originalFindByPk;
        SmsMessage.create = originalCreate;
        __resetAfricaTalkingClientForTests();
        if (previousProvider === undefined) delete process.env.SMS_PROVIDER;
        else process.env.SMS_PROVIDER = previousProvider;
        if (previousApiKey === undefined) delete process.env.AFRICASTALKING_API_KEY;
        else process.env.AFRICASTALKING_API_KEY = previousApiKey;
        if (previousUsername === undefined) delete process.env.AFRICASTALKING_USERNAME;
        else process.env.AFRICASTALKING_USERNAME = previousUsername;
        if (previousEnvironment === undefined) delete process.env.AFRICASTALKING_ENVIRONMENT;
        else process.env.AFRICASTALKING_ENVIRONMENT = previousEnvironment;
        if (previousSenderId === undefined) delete process.env.AFRICASTALKING_SENDER_ID;
        else process.env.AFRICASTALKING_SENDER_ID = previousSenderId;
    }
});

test('Africa\'s Talking Sandbox rejects missing credentials without making a request', async() => {
    const previousApiKey = process.env.AFRICASTALKING_API_KEY;
    const previousUsername = process.env.AFRICASTALKING_USERNAME;
    const previousEnvironment = process.env.AFRICASTALKING_ENVIRONMENT;
    let requestCount = 0;
    process.env.AFRICASTALKING_USERNAME = 'sandbox';
    process.env.AFRICASTALKING_ENVIRONMENT = 'sandbox';
    delete process.env.AFRICASTALKING_API_KEY;
    __setAfricaTalkingClientForTests({ post: async() => { requestCount += 1; } });

    try {
        await assert.rejects(
            () => sendAfricaTalkingSms({ to: '0976296127', message: 'Test message' }),
            (error) => error.code === SMS_CONFIGURATION_ERROR_CODE &&
                error.message === "Africa's Talking SMS provider is not configured.",
        );
        assert.equal(requestCount, 0);
    } finally {
        __resetAfricaTalkingClientForTests();
        if (previousApiKey === undefined) delete process.env.AFRICASTALKING_API_KEY;
        else process.env.AFRICASTALKING_API_KEY = previousApiKey;
        if (previousUsername === undefined) delete process.env.AFRICASTALKING_USERNAME;
        else process.env.AFRICASTALKING_USERNAME = previousUsername;
        if (previousEnvironment === undefined) delete process.env.AFRICASTALKING_ENVIRONMENT;
        else process.env.AFRICASTALKING_ENVIRONMENT = previousEnvironment;
    }
});

test('Africa\'s Talking Sandbox safely handles timeouts, invalid responses, and rejected recipient codes', async() => {
    const previousApiKey = process.env.AFRICASTALKING_API_KEY;
    const previousUsername = process.env.AFRICASTALKING_USERNAME;
    const previousEnvironment = process.env.AFRICASTALKING_ENVIRONMENT;
    const originalLoggerError = logger.error;
    const capturedLogs = [];
    process.env.AFRICASTALKING_API_KEY = 'sandbox-secret-key';
    process.env.AFRICASTALKING_USERNAME = 'sandbox';
    process.env.AFRICASTALKING_ENVIRONMENT = 'sandbox';
    logger.error = (...values) => capturedLogs.push(values);

    try {
        __setAfricaTalkingClientForTests({
            post: async() => {
                const error = new Error('timeout echoed with sandbox-secret-key');
                error.code = 'ECONNABORTED';
                throw error;
            },
        });
        await assert.rejects(
            () => sendAfricaTalkingSms({ to: '+251911234567', message: 'Test message' }),
            (error) => {
                assert.equal(error.message, "Africa's Talking request timed out.");
                assert.equal(error.message.includes('sandbox-secret-key'), false);
                return true;
            },
        );

        __setAfricaTalkingClientForTests({
            post: async() => ({ status: 200, data: { providerError: 'raw provider detail sandbox-secret-key' } }),
        });
        await assert.rejects(
            () => sendAfricaTalkingSms({ to: '+251911234567', message: 'Test message' }),
            /returned an invalid response/,
        );

        for (const statusCode of[null, '', 'not-a-status']) {
            __setAfricaTalkingClientForTests({
                post: async() => ({
                    status: 201,
                    data: { SMSMessageData: { Recipients: [{ statusCode }] } },
                }),
            });
            await assert.rejects(
                () => sendAfricaTalkingSms({ to: '+251911234567', message: 'Test message' }),
                /returned an invalid response/,
            );
        }

        __setAfricaTalkingClientForTests({
            post: async() => ({
                status: 201,
                data: { SMSMessageData: { Recipients: [{ statusCode: 401, status: 'Rejected', message: 'raw recipient detail' }] } },
            }),
        });
        await assert.rejects(
            () => sendAfricaTalkingSms({ to: '+251911234567', message: 'Test message' }),
            (error) => {
                assert.equal(error.message, "Africa's Talking rejected the recipient (status code 401).");
                assert.equal(error.message.includes('raw recipient detail'), false);
                assert.equal(error.message.includes('sandbox-secret-key'), false);
                return true;
            },
        );

        __setAfricaTalkingClientForTests({
            post: async() => {
                const error = new Error('raw provider detail sandbox-secret-key');
                error.response = { status: 403, data: { message: 'raw provider detail sandbox-secret-key' } };
                throw error;
            },
        });
        await assert.rejects(
            () => sendAfricaTalkingSms({ to: '+251911234567', message: 'Test message' }),
            (error) => {
                assert.equal(error.message, "Africa's Talking request failed with status 403.");
                assert.equal(error.message.includes('raw provider detail'), false);
                return true;
            },
        );

        const logs = JSON.stringify(capturedLogs);
        assert.equal(logs.includes('sandbox-secret-key'), false);
        assert.equal(logs.includes('raw provider detail'), false);
        assert.equal(logs.includes('+251911234567'), false);
    } finally {
        __resetAfricaTalkingClientForTests();
        logger.error = originalLoggerError;
        if (previousApiKey === undefined) delete process.env.AFRICASTALKING_API_KEY;
        else process.env.AFRICASTALKING_API_KEY = previousApiKey;
        if (previousUsername === undefined) delete process.env.AFRICASTALKING_USERNAME;
        else process.env.AFRICASTALKING_USERNAME = previousUsername;
        if (previousEnvironment === undefined) delete process.env.AFRICASTALKING_ENVIRONMENT;
        else process.env.AFRICASTALKING_ENVIRONMENT = previousEnvironment;
    }
});

test('production configuration selects the production endpoint and configured username', async() => {
    const previousApiKey = process.env.AFRICASTALKING_API_KEY;
    const previousUsername = process.env.AFRICASTALKING_USERNAME;
    const previousEnvironment = process.env.AFRICASTALKING_ENVIRONMENT;
    process.env.AFRICASTALKING_API_KEY = 'mock-key';
    process.env.AFRICASTALKING_USERNAME = 'production-account';
    process.env.AFRICASTALKING_ENVIRONMENT = 'production';

    try {
        __setAfricaTalkingClientForTests({
            post: async(url, body) => {
                assert.equal(url, 'https://api.africastalking.com/version1/messaging');
                assert.match(body, /^username=production-account&/);
                return { status: 201, data: { SMSMessageData: { Recipients: [{ statusCode: 102 }] } } };
            },
        });
        const result = await sendAfricaTalkingSms({ to: '+251911234567', message: 'Mocked SMS' });
        assert.equal(result.provider, 'africastalking');
    } finally {
        __resetAfricaTalkingClientForTests();
        if (previousApiKey === undefined) delete process.env.AFRICASTALKING_API_KEY;
        else process.env.AFRICASTALKING_API_KEY = previousApiKey;
        if (previousUsername === undefined) delete process.env.AFRICASTALKING_USERNAME;
        else process.env.AFRICASTALKING_USERNAME = previousUsername;
        if (previousEnvironment === undefined) delete process.env.AFRICASTALKING_ENVIRONMENT;
        else process.env.AFRICASTALKING_ENVIRONMENT = previousEnvironment;
    }
});

test('missing Africa\'s Talking configuration is typed, sanitized, and makes no request', async() => {
    const previousApiKey = process.env.AFRICASTALKING_API_KEY;
    const previousUsername = process.env.AFRICASTALKING_USERNAME;
    const previousEnvironment = process.env.AFRICASTALKING_ENVIRONMENT;
    let requestCount = 0;
    process.env.AFRICASTALKING_ENVIRONMENT = 'sandbox';
    process.env.AFRICASTALKING_USERNAME = 'sandbox';
    delete process.env.AFRICASTALKING_API_KEY;
    __setAfricaTalkingClientForTests({ post: async() => { requestCount += 1; } });

    try {
        await assert.rejects(
            () => sendAfricaTalkingSms({ to: '0976296127', message: 'Test message' }),
            (error) => error instanceof SmsProviderConfigurationError &&
                error.code === SMS_CONFIGURATION_ERROR_CODE &&
                !/key|credential/i.test(error.message),
        );
        process.env.AFRICASTALKING_API_KEY = 'mock-key';
        delete process.env.AFRICASTALKING_USERNAME;
        await assert.rejects(
            () => sendAfricaTalkingSms({ to: '0976296127', message: 'Test message' }),
            (error) => error.code === SMS_CONFIGURATION_ERROR_CODE &&
                error.message === "Africa's Talking SMS provider is not configured.",
        );
        assert.throws(() => assertSmsProviderConfigured(), { code: SMS_CONFIGURATION_ERROR_CODE });
        assert.equal(requestCount, 0);
    } finally {
        __resetAfricaTalkingClientForTests();
        if (previousApiKey === undefined) delete process.env.AFRICASTALKING_API_KEY;
        else process.env.AFRICASTALKING_API_KEY = previousApiKey;
        if (previousUsername === undefined) delete process.env.AFRICASTALKING_USERNAME;
        else process.env.AFRICASTALKING_USERNAME = previousUsername;
        if (previousEnvironment === undefined) delete process.env.AFRICASTALKING_ENVIRONMENT;
        else process.env.AFRICASTALKING_ENVIRONMENT = previousEnvironment;
    }
});

test('sendSmsMessage skips provider calls for duplicate notifications', async() => {
    const originalFindByPk = User.findByPk;
    const originalFindOne = SmsMessage.findOne;
    const recipient = {
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Recipient',
        phone: '0976296127',
    };
    let requestCount = 0;
    User.findByPk = async() => recipient;
    SmsMessage.findOne = async() => ({
        sms_id: '323e4567-e89b-12d3-a456-426614174000',
        provider: 'africastalking',
        status: 'sent',
    });
    __setAfricaTalkingClientForTests({ post: async() => { requestCount += 1; } });

    try {
        const result = await sendSmsMessage({
            senderUserId: '223e4567-e89b-12d3-a456-426614174000',
            recipientUserId: recipient.user_id,
            message: 'SOS ALERT',
            idempotencyKey: 'sos:incident-123',
        });
        assert.equal(result.duplicate, true);
        assert.equal(result.status, 'sent');
        assert.equal(requestCount, 0);
    } finally {
        User.findByPk = originalFindByPk;
        SmsMessage.findOne = originalFindOne;
        __resetAfricaTalkingClientForTests();
    }
});

test('sendSmsMessage rejects missing recipients before provider configuration or request', async() => {
    const originalFindByPk = User.findByPk;
    let requestCount = 0;
    User.findByPk = async() => null;
    __setAfricaTalkingClientForTests({ post: async() => { requestCount += 1; } });

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
        assert.equal(requestCount, 0);
    } finally {
        User.findByPk = originalFindByPk;
        __resetAfricaTalkingClientForTests();
    }
});