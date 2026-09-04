const axios = require('axios');
const { User, SmsMessage } = require('../models');
const { logger } = require('../utils/logger');
const { validatePhoneNumber, normalizePhoneNumber, sanitizeSmsMessage, toE164 } = require('../utils/smsValidation');
const { lomisendApiKey, lomisendSenderId, lomisendTimeoutMs } = require('../config/auth');

let testLomisendClient = null;

const __setLomisendClientForTests = (client) => {
  testLomisendClient = client;
};

const __resetLomisendClientForTests = () => {
  testLomisendClient = null;
};

const getSmsProviderMode = () => 'lomisend';

const getLomisendConfig = () => ({
  apiKey: process.env.LOMISEND_API_KEY || lomisendApiKey || '',
  senderId: process.env.LOMISEND_SENDER_ID || lomisendSenderId || '',
  timeoutMs: Number(process.env.LOMISEND_TIMEOUT_MS || lomisendTimeoutMs || 20000),
});

const getLomisendRequestBody = ({ to, message, from = lomisendSenderId }) => {
  const body = {
    to: toE164(to),
    body: String(message).trim(),
  };

  if (from) {
    body.sender_id = from;
  }

  const projectId = process.env.LOMISEND_PROJECT_ID;
  if (projectId) {
    body.id = projectId;
  }

  return body;
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

  const { apiKey, senderId, timeoutMs } = getLomisendConfig();
  const effectiveFrom = from || senderId;

  if (!apiKey) {
    throw new Error('LOMISEND_API_KEY is not configured in the backend environment.');
  }

  const requestBody = getLomisendRequestBody({ to: recipientNumber, message: text, from: effectiveFrom });

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
      throw new Error(providerData.message || providerData.error || 'Lomisend rejected the SMS request.');
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
    const providerError = error?.response?.data?.detail
      || error?.response?.data?.message
      || error?.response?.data?.error
      || error?.response?.data?.errorMessage
      || error?.message
      || 'SMS provider request failed.';

    const normalized = String(providerError).toLowerCase();

    if (normalized.includes('unauthorized') || normalized.includes('authentication') || normalized.includes('api key') || normalized.includes('forbidden')) {
      throw new Error('SMS provider authentication failed. Verify the Lomisend API key and credentials.');
    }

    if (normalized.includes('invalid phone') || normalized.includes('invalid number') || normalized.includes('validation-failed')) {
      throw new Error('Recipient phone number is invalid for SMS delivery.');
    }

    if (normalized.includes('balance') || normalized.includes('credit') || normalized.includes('insufficient') || normalized.includes('no quota')) {
      throw new Error('SMS provider rejected the request because the account balance or credits are insufficient.');
    }

    if (normalized.includes('timeout')) {
      throw new Error('SMS provider request timed out while sending the message.');
    }

    logger.error('Lomisend SMS delivery failed', {
      status: error?.response?.status,
      message: providerError,
    });

    throw new Error(providerError);
  }
};

const sendSmsMessage = async ({ senderUserId, recipientUserId, recipientPhone, message }) => {
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

  const smsRecord = await SmsMessage.create({
    sender_user_id: senderUserId,
    recipient_user_id: recipientUserId,
    recipient_phone: normalizedPhone,
    message: safeMessage,
    status: 'queued',
    provider: 'lomisend',
  });

  try {
    const result = await sendLomisendSms({ to: normalizedPhone, message: safeMessage });

    const appStatus = result.status === 'delivered' ? 'delivered' : ['accepted', 'pending', 'queued', 'sent', 'delivered'].includes(result.status) ? 'sent' : 'failed';

    await smsRecord.update({
      status: appStatus,
      provider: result.provider,
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
      provider: 'lomisend',
      provider_response: JSON.stringify({ error: errorText }),
      error_message: errorText.slice(0, 500),
    });

    throw new Error(errorText);
  }
};

module.exports = {
  getSmsProviderMode,
  sendSmsMessage,
  sendLomisendSms,
  __setLomisendClientForTests,
  __resetLomisendClientForTests,
};
