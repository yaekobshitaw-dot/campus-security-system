const axios = require('axios');
const { User, SmsMessage } = require('../models');
const { logger } = require('../utils/logger');
const { validatePhoneNumber, normalizePhoneNumber, sanitizeSmsMessage, toE164 } = require('../utils/smsValidation');
const { lomisendApiKey, lomisendProjectId, lomisendSenderId, lomisendTimeoutMs } = require('../config/auth');
const { sendGsmSms } = require('./smsProviders/gsmProvider');

let testLomisendClient = null;

const __setLomisendClientForTests = (client) => {
  testLomisendClient = client;
};

const __resetLomisendClientForTests = () => {
  testLomisendClient = null;
};

const getSmsProviderMode = () => String(process.env.SMS_PROVIDER || 'lomisend').trim().toLowerCase();

const getSmsProvider = () => {
  const provider = getSmsProviderMode();
  if (provider === 'lomisend') return { name: provider, send: sendLomisendSms };
  if (provider === 'gsm') return { name: provider, send: sendGsmSms };
  throw new Error(`Unsupported SMS provider: ${provider}`);
};

const getLomisendConfig = () => ({
  apiKey: process.env.LOMISEND_API_KEY || lomisendApiKey || '',
  projectId: process.env.LOMISEND_PROJECT_ID || lomisendProjectId || '',
  senderId: process.env.LOMISEND_SENDER_ID || lomisendSenderId || '',
  timeoutMs: Number(process.env.LOMISEND_TIMEOUT_MS || lomisendTimeoutMs || 20000),
});

const getLomisendRequestBody = ({ to, message, projectId, from }) => {
  const body = {
    id: projectId,
    to: toE164(to),
    body: String(message).trim(),
  };

  if (from && String(from).trim().toUpperCase() !== 'YOUR_SENDER_ID') {
    body.sender_id = from;
  }

  return body;
};

const getProviderMessage = (error) => error?.response?.data?.detail
  || error?.response?.data?.message
  || error?.response?.data?.error
  || error?.response?.data?.errorMessage
  || error?.message
  || 'SMS provider request failed.';

const createLomisendError = (statusCode, providerMessage) => {
  const messages = {
    401: 'Lomisend API authentication error',
    402: 'Insufficient Lomisend balance or credits',
    403: 'Lomisend subscription, permission, project, or sender restriction',
    422: 'Invalid Lomisend request, sender, or project configuration',
  };
  const prefix = messages[statusCode] || `Lomisend request failed with status ${statusCode}`;
  const error = new Error(`${prefix}: ${providerMessage}`);
  error.statusCode = statusCode;
  error.providerMessage = providerMessage;
  return error;
};

const sendLomisendSms = async ({ to, message, from } = {}) => {
  const recipientNumber = toE164(to);
  if (!recipientNumber) {
    throw new Error('Recipient phone number is invalid for SMS delivery.');
  }

  const text = String(message || '').trim();
  if (!text) {
    throw new Error('SMS text cannot be empty.');
  }

  const { apiKey, projectId, senderId, timeoutMs } = getLomisendConfig();
  const configuredSenderId = from || senderId;
  const effectiveFrom = configuredSenderId && String(configuredSenderId).trim().toUpperCase() !== 'YOUR_SENDER_ID'
    ? String(configuredSenderId).trim()
    : '';

  if (!apiKey) {
    throw new Error('LOMISEND_API_KEY is not configured in the backend environment.');
  }

  if (!projectId) {
    throw new Error('LOMISEND_PROJECT_ID is not configured in the backend environment.');
  }

  const requestBody = getLomisendRequestBody({
    to: recipientNumber,
    message: text,
    projectId,
    from: effectiveFrom,
  });

  try {
    const client = testLomisendClient || axios;
    const response = await client.post('https://api.lomisend.com/v1/send-message', requestBody, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': apiKey,
      },
      timeout: timeoutMs,
    });

    const providerData = response?.data?.data || response?.data || {};
    const providerStatus = String(providerData.status || 'accepted').trim().toLowerCase();
    const providerMessageId = providerData.id || providerData.messageId || providerData.message_id || providerData.smsId || null;
    const acceptedStatuses = new Set(['accepted', 'pending', 'queued', 'sent', 'delivered']);

    if (response.status !== 200 && response.status !== 202) {
      throw createLomisendError(response.status, getProviderMessage({ response }));
    }

    if (!acceptedStatuses.has(providerStatus)) {
      const providerError = providerData.message || providerData.error || 'Lomisend rejected the SMS request.';
      throw new Error(providerError);
    }

    return {
      provider: 'lomisend',
      messageId: providerMessageId,
      status: providerStatus,
      rawResponse: providerData,
    };
  } catch (error) {
    const providerError = getProviderMessage(error);
    const statusCode = error?.response?.status || error?.statusCode;

    if (statusCode) {
      const mappedError = createLomisendError(statusCode, providerError);
      logger.error('Lomisend SMS delivery failed', {
        status: statusCode,
        message: providerError,
      });
      throw mappedError;
    }

    logger.error('Lomisend SMS delivery failed', {
      status: undefined,
      message: providerError,
    });

    throw error;
  }
};

const sendSmsMessage = async ({ senderUserId, recipientUserId, recipientPhone, message, broadcastId = null, idempotencyKey = null }) => {
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

  const provider = getSmsProvider();
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

    const appStatus = result.status === 'delivered' ? 'delivered' : ['accepted', 'pending', 'queued', 'sent', 'delivered'].includes(result.status) ? 'sent' : 'failed';

    await smsRecord.update({
      status: appStatus,
      provider: result.provider || provider.name,
      provider_message_id: result.messageId,
      provider_response: JSON.stringify(result.rawResponse || {}),
      sent_at: appStatus === 'failed' ? null : new Date(),
      error_message: null,
    });

    return {
      sms_id: smsRecord.sms_id,
      provider: result.provider,
      status: appStatus,
      message: appStatus === 'delivered' ? 'SMS delivered according to the provider response.' : 'SMS accepted by the configured Lomisend provider and queued for processing.',
      recipient: {
        user_id: recipient.user_id,
        name: recipient.name,
        phone: normalizedPhone,
      },
    };
  } catch (error) {
    const errorText = error.message || 'SMS delivery failed.';
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
  getSmsProviderMode,
  getSmsProvider,
  sendSmsMessage,
  sendLomisendSms,
  getLomisendRequestBody,
  __setLomisendClientForTests,
  __resetLomisendClientForTests,
};
