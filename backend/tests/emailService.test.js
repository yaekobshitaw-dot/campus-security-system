const axios = require('axios');
const test = require('node:test');
const assert = require('node:assert/strict');
const emailService = require('../src/services/emailService');

const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const configKeys = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_SENDER'];

const withGmailConfig = async(run) => {
    const previous = Object.fromEntries(configKeys.map((key) => [key, process.env[key]]));
    Object.assign(process.env, {
        GMAIL_CLIENT_ID: 'test-client-id',
        GMAIL_CLIENT_SECRET: 'test-client-secret',
        GMAIL_REFRESH_TOKEN: 'test-refresh-token',
        GMAIL_SENDER: 'security-test@example.test'
    });

    try {
        await run();
    } finally {
        for (const key of configKeys) {
            if (previous[key] === undefined) delete process.env[key];
            else process.env[key] = previous[key];
        }
    }
};

test('reports revoked refresh-token errors without exposing OAuth response details', async() => {
    await withGmailConfig(async() => {
        const originalPost = axios.post;
        axios.post = async() => {
            const error = new Error('response contained sensitive test material');
            error.response = {
                status: 400,
                data: { error: 'invalid_grant', error_description: 'test-refresh-token' }
            };
            throw error;
        };

        try {
            const diagnostic = await emailService.getEmailTransportDiagnostic();
            assert.equal(diagnostic.authentication, 'failed');
            assert.equal(diagnostic.errorCode, 'invalid_grant');
            assert.equal(diagnostic.hostReachable, true);
            assert.match(diagnostic.errorMessage, /GMAIL_REFRESH_TOKEN/);
            assert.doesNotMatch(diagnostic.errorMessage, /test-refresh-token|test-client-secret/);
        } finally {
            axios.post = originalPost;
        }
    });
});

test('re-exchanges access token once after Gmail rejects it and self-test only targets GMAIL_SENDER', async() => {
    await withGmailConfig(async() => {
        const originalPost = axios.post;
        const calls = [];
        let tokenCount = 0;
        let sendCount = 0;
        axios.post = async(url, body, options) => {
            calls.push({ url, body, options });
            if (url === GMAIL_TOKEN_URL) {
                tokenCount += 1;
                return { data: { access_token: `test-access-${tokenCount}` } };
            }
            sendCount += 1;
            if (sendCount === 1) {
                const error = new Error('unauthorized');
                error.response = { status: 401, data: { error: { message: 'sensitive response' } } };
                throw error;
            }
            return { data: { id: 'test-message-id' } };
        };

        try {
            const result = await emailService.sendGmailSelfTest();
            const sendCalls = calls.filter((call) => call.url === GMAIL_SEND_URL);
            const message = Buffer.from(sendCalls[0].body.raw, 'base64url').toString('utf8');
            assert.equal(result.id, 'test-message-id');
            assert.equal(tokenCount, 2);
            assert.equal(sendCount, 2);
            assert.equal(sendCalls[0].options.headers.Authorization, 'Bearer test-access-1');
            assert.equal(sendCalls[1].options.headers.Authorization, 'Bearer test-access-2');
            assert.match(message, /To: security-test@example\.test/);
            assert.doesNotMatch(message, /@gmail\.com/);
        } finally {
            axios.post = originalPost;
        }
    });
});