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

test('admin broadcast returns prior records for a repeated idempotency key', async() => {
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
    const sentSmsService = {
        sendSmsMessage: async() => {
            const record = {
                sms_id: '323e4567-e89b-12d3-a456-426614174000',
                recipient_user_id: recipientId,
                recipient_phone: recipient.phone,
                status: 'queued',
                provider: 'africastalking',
                provider_response: '{}',
                error_message: null,
                created_at: new Date().toISOString(),
                recipient: { name: recipient.name, role: recipient.role },
            };
            records.push(record);
            return { sms_id: record.sms_id };
        },
        assertSmsProviderConfigured: () => {}
    };

    require.cache[smsServicePath] = { id: smsServicePath, filename: smsServicePath, loaded: true, exports: sentSmsService };
    delete require.cache[controllerPath];
    const { broadcastSms } = require('../src/controllers/smsController');
    User.findAll = async() => [recipient];
    SmsMessage.findAll = async({ where }) => where && where.idempotency_key ? records : [];
    SmsMessage.findByPk = async() => records[0];
    SmsMessage.create = async(values) => ({...values, sms_id: 'failed-record', created_at: new Date().toISOString(), recipient });

    try {
        const request = { user: { user_id: adminId }, body: { recipientUserIds: [recipientId], message: 'Campus notice', idempotencyKey: 'broadcast-key-123456' } };
        const firstResponse = makeResponse();
        await broadcastSms(request, firstResponse);
        assert.equal(firstResponse.statusCode, 202);
        assert.equal(firstResponse.payload.success, true);
        assert.match(firstResponse.payload.message, /delivery is not confirmed/);
        assert.equal(firstResponse.payload.data.successful, 0);
        assert.equal(firstResponse.payload.data.queued, 1);
        assert.equal(firstResponse.payload.data.results[0].status, 'queued');
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

test('broadcast returns 503 and sends nothing when Africa\'s Talking is misconfigured', async() => {
    const adminId = '223e4567-e89b-12d3-a456-426614174000';
    const originalSmsFindAll = SmsMessage.findAll;
    let sendCount = 0;
    const configurationError = Object.assign(new Error("Africa's Talking SMS provider is not configured."), {
        code: 'SMS_PROVIDER_CONFIGURATION',
    });
    const smsService = {
        assertSmsProviderConfigured() { throw configurationError; },
        sendSmsMessage: async() => { sendCount += 1; },
    };

    require.cache[smsServicePath] = { id: smsServicePath, filename: smsServicePath, loaded: true, exports: smsService };
    delete require.cache[controllerPath];
    const { broadcastSms } = require('../src/controllers/smsController');
    SmsMessage.findAll = async() => [];

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

test('single SMS request returns 503 when Africa\'s Talking is misconfigured', async() => {
    const recipientId = '123e4567-e89b-12d3-a456-426614174000';
    const adminId = '223e4567-e89b-12d3-a456-426614174000';
    const originalUserFindByPk = User.findByPk;
    const configurationError = Object.assign(new Error("Africa's Talking SMS provider is not configured."), {
        code: 'SMS_PROVIDER_CONFIGURATION',
    });
    const smsService = {
        assertSmsProviderConfigured() {},
        sendSmsMessage: async() => { throw configurationError; },
    };

    require.cache[smsServicePath] = { id: smsServicePath, filename: smsServicePath, loaded: true, exports: smsService };
    delete require.cache[controllerPath];
    const { createSmsRequest } = require('../src/controllers/smsController');
    User.findByPk = async() => ({ user_id: recipientId, phone: '0976296127', is_active: true });

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

test('broadcast reports total failure and partial acceptance with explicit statuses', async() => {
    const adminId = '223e4567-e89b-12d3-a456-426614174000';
    const firstRecipientId = '123e4567-e89b-12d3-a456-426614174000';
    const secondRecipientId = '423e4567-e89b-12d3-a456-426614174000';
    const recipients = [
        { user_id: firstRecipientId, name: 'Student One', role: 'student', phone: '0976296127', is_active: true },
        { user_id: secondRecipientId, name: 'Student Two', role: 'student', phone: '0976296128', is_active: true },
    ];
    const original = {
        userFindAll: User.findAll,
        smsFindAll: SmsMessage.findAll,
        smsFindByPk: SmsMessage.findByPk,
        smsFindOne: SmsMessage.findOne,
        smsCreate: SmsMessage.create,
    };
    const records = new Map();
    let failingRecipientIds = new Set();
    let statusUpdateFails = false;
    let providerCallCount = 0;
    const smsService = {
        assertSmsProviderConfigured() {},
        sendSmsMessage: async({ recipientUserId, broadcastId, idempotencyKey }) => {
            providerCallCount += 1;
            const smsId = `sms-${recipientUserId}`;
            const record = {
                sms_id: smsId,
                recipient_user_id: recipientUserId,
                recipient_phone: recipients.find((user) => user.user_id === recipientUserId).phone,
                status: 'queued',
                provider: 'africastalking',
                provider_response: null,
                broadcast_id: broadcastId,
                idempotency_key: idempotencyKey,
                error_message: null,
                created_at: new Date().toISOString(),
                recipient: { name: 'Student', role: 'student' },
                update: async(values) => {
                    if (statusUpdateFails) throw new Error('Database status update failed.');
                    return Object.assign(record, values);
                },
            };
            records.set(smsId, record);
            if (failingRecipientIds.has(recipientUserId)) {
                const error = Object.assign(new Error('Africa\'s Talking request failed with status 401.'), {
                    response: { status: 401 },
                });
                try {
                    await record.update({ status: 'failed', provider_response: JSON.stringify({ error: error.message }) });
                } catch (_updateError) {
                    // Mimic the provider service failing to persist the rejected status.
                }
                throw error;
            }
            record.provider_response = '{}';
            return { sms_id: smsId };
        },
    };

    require.cache[smsServicePath] = { id: smsServicePath, filename: smsServicePath, loaded: true, exports: smsService };
    delete require.cache[controllerPath];
    const { broadcastSms } = require('../src/controllers/smsController');
    User.findAll = async() => recipients;
    SmsMessage.findAll = async({ where } = {}) => where && where.idempotency_key ? [...records.values()].filter((record) => record.idempotency_key === where.idempotency_key) : [];
    SmsMessage.findByPk = async(smsId) => records.get(smsId);
    SmsMessage.findOne = async({ where }) => [...records.values()].find((record) =>
        record.broadcast_id === where.broadcast_id && record.recipient_user_id === where.recipient_user_id,
    ) || null;
    SmsMessage.create = async(values) => {
        const record = {
            ...values,
            sms_id: `failed-${values.recipient_user_id}`,
            created_at: new Date().toISOString(),
            recipient: { name: 'Student', role: 'student' },
        };
        records.set(record.sms_id, record);
        return record;
    };

    const sendBroadcast = async(recipientUserIds, idempotencyKey) => {
        const response = makeResponse();
        await broadcastSms({
            user: { user_id: adminId },
            body: { recipientUserIds, message: 'Mock campus notice', idempotencyKey },
        }, response);
        return response;
    };

    try {
        failingRecipientIds = new Set([firstRecipientId]);
        const totalFailure = await sendBroadcast([firstRecipientId], 'broadcast-total-failure-123');
        assert.equal(totalFailure.statusCode, 502);
        assert.equal(totalFailure.payload.success, false);
        assert.equal(totalFailure.payload.partial, false);
        assert.equal(totalFailure.payload.data.failed, 1);
        assert.equal(totalFailure.payload.data.results[0].status, 'failed');
        assert.match(totalFailure.payload.message, /failed for all recipients/);

        const totalFailureDuplicate = await sendBroadcast([firstRecipientId], 'broadcast-total-failure-123');
        assert.equal(totalFailureDuplicate.statusCode, 502);
        assert.equal(totalFailureDuplicate.payload.success, false);
        assert.equal(totalFailureDuplicate.payload.duplicate, true);

        records.clear();
        statusUpdateFails = true;
        const failedStatusUpdate = await sendBroadcast([firstRecipientId], 'broadcast-status-update-failure-123');
        assert.equal(failedStatusUpdate.statusCode, 502);
        assert.equal(failedStatusUpdate.payload.data.failed, 1);
        assert.equal(failedStatusUpdate.payload.data.results[0].status, 'failed');

        const callsBeforeRetry = providerCallCount;
        const staleQueuedDuplicate = await sendBroadcast([firstRecipientId], 'broadcast-status-update-failure-123');
        assert.equal(staleQueuedDuplicate.statusCode, 502);
        assert.equal(staleQueuedDuplicate.payload.success, false);
        assert.equal(staleQueuedDuplicate.payload.data.queued, 0);
        assert.equal(staleQueuedDuplicate.payload.data.failed, 1);
        assert.equal(staleQueuedDuplicate.payload.data.results[0].status, 'failed');
        assert.match(staleQueuedDuplicate.payload.data.results[0].error, /outcome could not be confirmed/i);
        assert.equal(providerCallCount, callsBeforeRetry);

        records.clear();
        statusUpdateFails = false;
        failingRecipientIds = new Set([secondRecipientId]);
        const partial = await sendBroadcast([firstRecipientId, secondRecipientId], 'broadcast-partial-result-123');
        assert.equal(partial.statusCode, 207);
        assert.equal(partial.payload.success, false);
        assert.equal(partial.payload.partial, true);
        assert.equal(partial.payload.data.queued, 1);
        assert.equal(partial.payload.data.failed, 1);
        assert.deepEqual(partial.payload.data.results.map((item) => item.status), ['queued', 'failed']);
        assert.equal(partial.payload.data.successful + partial.payload.data.queued + partial.payload.data.failed, partial.payload.data.total);
        assert.match(partial.payload.message, /partially accepted/);
        assert.match(partial.payload.message, /delivery is not confirmed/);
    } finally {
        User.findAll = original.userFindAll;
        SmsMessage.findAll = original.smsFindAll;
        SmsMessage.findByPk = original.smsFindByPk;
        SmsMessage.findOne = original.smsFindOne;
        SmsMessage.create = original.smsCreate;
        if (originalSmsService) require.cache[smsServicePath] = originalSmsService;
        else delete require.cache[smsServicePath];
        delete require.cache[controllerPath];
    }
});