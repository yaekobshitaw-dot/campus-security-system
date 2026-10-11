const axios = require('axios');
const { User, SmsMessage } = require('../models');
const { logger } = require('../utils/logger');
const { validatePhoneNumber, normalizePhoneNumber, sanitizeSmsMessage, toE164 } = require('../utils/smsValidation');

const SMS_CONFIGURATION_ERROR_CODE = 'SMS_PROVIDER_CONFIGURATION';

let testAfricaTalkingClient = null;

class SmsProviderConfigurationError extends Error {
    constructor() {
        super("Africa's Talking SMS provider is not configured.");
        this.name = 'SmsProviderConfigurationError';
        this.code = SMS_CONFIGURATION_ERROR_CODE;
    }
};

const __setAfricaTalkingClientForTests = (client) => {
    testAfricaTalkingClient = client;
};

const __resetAfricaTalkingClientForTests = () => {
    testAfricaTalkingClient = null;
};

const getSmsProvider = () => {
    const configuredProvider = String(process.env.SMS_PROVIDER || '').trim().toLowerCase();
    if (configuredProvider && configuredProvider !== 'africastalking') {
        throw new SmsProviderConfigurationError();
    }
    return { name: 'africastalking', send: sendAfricaTalkingSms };
};

const getAfricaTalkingConfig = () => {
    const environment = String(process.env.AFRICASTALKING_ENVIRONMENT || 'sandbox').trim().toLowerCase();
    const apiKey = String(process.env.AFRICASTALKING_API_KEY || '').trim();
    const username = String(process.env.AFRICASTALKING_USERNAME || '').trim();
    const senderId = String(process.env.AFRICASTALKING_SENDER_ID || '').trim();
    const timeoutMs = Number(process.env.AFRICASTALKING_TIMEOUT_MS || 20000);

    if (!apiKey || !username || !['sandbox', 'production'].includes(environment) ||
        (environment === 'sandbox' && username !== 'sandbox') ||
        (environment === 'production' && username.toLowerCase() === 'sandbox')) {
        throw new SmsProviderConfigurationError();
    }

    return {
        apiKey,
        username,
        senderId,
        timeoutMs,
        endpoint: environment === 'sandbox' ?
            'https://api.sandbox.africastalking.com/version1/messaging' : 'https://api.africastalking.com/version1/messaging',
        environment,
    };
};

const assertSmsProviderConfigured = () => {
    getSmsProvider();
    getAfricaTalkingConfig();
};

const getAfricaTalkingRequestBody = ({ to, message, username, from } = {}) => {
    const body = new URLSearchParams({
        username,
        to: toE164(to),
        message: String(message).trim(),
    });
    const senderId = String(from || '').trim();
    if (senderId && senderId.toUpperCase() !== 'YOUR_SENDER_ID') {
        body.set('from', senderId);
    }
    return body;
};

const sendAfricaTalkingSms = async({ to, message, from } = {}) => {
    if (!validatePhoneNumber(to)) {
        throw new Error('Recipient phone number is invalid for SMS delivery.');
    }

    const text = String(message || '').trim();
    if (!text) {
        throw new Error('SMS text cannot be empty.');
    }

    const { apiKey, username, senderId, timeoutMs, endpoint, environment } = getAfricaTalkingConfig();

    const configuredSenderId = from || senderId;
    const requestBody = getAfricaTalkingRequestBody({
        to,
        message: text,
        username,
        from: configuredSenderId,
    });

    let response;
    try {
        const client = testAfricaTalkingClient || axios;
        response = await client.post(endpoint, requestBody.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
                apiKey,
            },
            timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 20000,
        });
    } catch (error) {
        const statusCode = error?.response?.status;
        if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT' || /timeout/i.test(error?.message || '')) {
            logger.error("Africa's Talking SMS delivery failed", { environment, status: 'timeout' });
            throw new Error("Africa's Talking request timed out.");
        }
        if (statusCode) {
            logger.error("Africa's Talking SMS delivery failed", { environment, status: statusCode });
            if (statusCode === 401) {
                throw new Error("Africa's Talking API credentials were rejected.");
            }
            throw new Error(`Africa's Talking request failed with status ${statusCode}.`);
        }
        logger.error("Africa's Talking SMS delivery failed", { environment, status: 'network_error' });
        throw new Error("Africa's Talking request failed due to a provider or network error.");
    }

    if (!Number.isInteger(response?.status) || response.status < 200 || response.status >= 300) {
        const statusCode = Number.isInteger(response?.status) ? response.status : null;
        logger.error("Africa's Talking SMS delivery failed", { environment, status: statusCode || 'invalid_response' });
        throw new Error(statusCode ?
            `Africa's Talking request failed with status ${statusCode}.` :
            "Africa's Talking returned an invalid response.");
    }

    const providerData = response?.data?.SMSMessageData;
    const recipients = providerData?.Recipients;
    const recipient = Array.isArray(recipients) && recipients.length === 1 ? recipients[0] : null;
    const rawStatusCode = recipient?.statusCode;
    const hasValidStatusCode = Number.isInteger(rawStatusCode) ||
        (typeof rawStatusCode === 'string' && /^\d+$/.test(rawStatusCode));
    if (!hasValidStatusCode) {
        logger.error("Africa's Talking SMS delivery failed", { environment, status: 'invalid_response' });
        throw new Error("Africa's Talking returned an invalid response.");
    }

    const recipientStatusCode = Number(rawStatusCode);
    if (![100, 101, 102].includes(recipientStatusCode)) {
        logger.error("Africa's Talking SMS delivery failed", { environment, status: recipientStatusCode });
        throw new Error(`Africa's Talking rejected the recipient (status code ${recipientStatusCode}).`);
    }

    return {
        provider: 'africastalking',
        messageId: recipient.messageId || recipient.message_id || null,
        status: recipientStatusCode === 102 ? 'queued' : recipientStatusCode === 101 ? 'sent' : 'accepted',
        rawResponse: {
            statusCode: recipientStatusCode,
            messageId: recipient.messageId || recipient.message_id || null,
        },
    };
};

const getSafeDeliveryError = (error) => {
    if (error?.code === SMS_CONFIGURATION_ERROR_CODE) {
        return error.message;
    }
    if (/^Africa's Talking (?:API credentials were rejected|request failed with status \d+|returned an invalid response|rejected the recipient \(status code \d+\)|request timed out|request failed due to a provider or network error)\./.test(error?.message || '')) {
        return error.message;
    }
    if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT' || /timeout/i.test(error?.message || '')) {
        return "Africa's Talking request timed out.";
    }
    return "Africa's Talking SMS delivery failed due to a provider or network error.";
};

const sendSmsMessage = async({ senderUserId, recipientUserId, recipientPhone, message, broadcastId = null, idempotencyKey = null }) => {
    if (!senderUserId) {
        throw new Error('A sender user is required to send SMS messages.');
    }

    const recipient = await User.findByPk(recipientUserId);
    if (!recipient) {
        throw new Error('Recipient user not found.');
    }

    const phoneValue = recipientPhone || recipient.phone || recipient.mobile_phone || recipient.phone_number;
    if (!validatePhoneNumber(phoneValue)) {
        throw new Error('Recipient does not have a valid phone number on file.');
    }

    const normalizedPhone = normalizePhoneNumber(phoneValue);
    const safeMessage = sanitizeSmsMessage(message);
    if (!safeMessage) {
        throw new Error('SMS message cannot be empty.');
    }

    if (idempotencyKey) {
        const existingSms = await SmsMessage.findOne({
            where: { idempotency_key: idempotencyKey, recipient_user_id: recipientUserId },
        });
        if (existingSms) {
            return {
                sms_id: existingSms.sms_id,
                provider: existingSms.provider,
                status: existingSms.status,
                duplicate: true,
                message: 'This notification was already processed.',
                recipient: {
                    user_id: recipient.user_id,
                    name: recipient.name,
                    phone: normalizedPhone,
                },
            };
        }
    }

    const provider = getSmsProvider();
    assertSmsProviderConfigured();
    const smsRecord = await SmsMessage.create({
        sender_user_id: senderUserId,
        recipient_user_id: recipientUserId,
        recipient_phone: normalizedPhone,
        message: safeMessage,
        status: 'queued',
        provider: provider.name,
        broadcast_id: broadcastId,
        idempotency_key: idempotencyKey,
    });

    try {
        const result = await provider.send({ to: normalizedPhone, message: safeMessage });

        const appStatus = 'queued';
        await smsRecord.update({
            status: appStatus,
            provider: result.provider || provider.name,
            provider_message_id: result.messageId,
            provider_response: JSON.stringify(result.rawResponse || {}),
            sent_at: null,
            error_message: null,
        });

        return {
            sms_id: smsRecord.sms_id,
            provider: result.provider,
            status: appStatus,
            message: "SMS accepted by Africa's Talking and queued for delivery; delivery is not yet confirmed.",
            recipient: {
                user_id: recipient.user_id,
                name: recipient.name,
                phone: normalizedPhone,
            },
        };
    } catch (error) {
        const errorText = getSafeDeliveryError(error);
        await smsRecord.update({
            status: 'failed',
            provider: provider.name,
            provider_response: JSON.stringify({ error: errorText }),
            error_message: errorText.slice(0, 500),
        });

        throw new Error(errorText);
    }
};

module.exports = {
    getSmsProvider,
    assertSmsProviderConfigured,
    SMS_CONFIGURATION_ERROR_CODE,
    SmsProviderConfigurationError,
    sendSmsMessage,
    sendAfricaTalkingSms,
    getAfricaTalkingRequestBody,
    __setAfricaTalkingClientForTests,
    __resetAfricaTalkingClientForTests,
};