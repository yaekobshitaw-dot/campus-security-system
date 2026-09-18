const { randomUUID } = require('crypto');
const { User, SmsMessage } = require('../models');
const { sendSmsMessage } = require('../services/smsService');
const {
  validateSmsPayload,
  validateBroadcastPayload,
  validatePhoneNumber,
  normalizePhoneNumber,
  sanitizeSmsMessage,
} = require('../utils/smsValidation');
const { recordAudit } = require('../services/auditService');
const { notifyUsers } = require('../services/notificationPersistence');

const broadcastInFlight = new Map();

const summarizeRecord = (item) => ({
  sms_id: item.sms_id,
  user_id: item.recipient_user_id,
  name: item.recipient?.name,
  role: item.recipient?.role,
  phone: item.recipient_phone,
  status: item.status,
  provider: item.provider,
  error: item.error_message || null,
  created_at: item.created_at,
});

const summarizeResults = (records) => {
  const results = records.map((item) => summarizeRecord(item));
  return {
    total: results.length,
    successful: results.filter((item) => ['sent', 'delivered'].includes(item.status)).length,
    failed: results.filter((item) => item.status === 'failed').length,
    queued: results.filter((item) => item.status === 'queued').length,
    results,
  };
};

const getAdminSmsRecipients = async (req, res) => {
  try {
    const role = String(req.query.role || 'all').trim().toLowerCase();
    const roles = role === 'all' ? ['student', 'faculty', 'staff', 'security', 'admin'] : [role];
    if (!roles.every((value) => ['student', 'faculty', 'staff', 'security', 'admin'].includes(value))) {
      return res.status(400).json({ success: false, message: 'Invalid recipient role filter.' });
    }

    const users = await User.findAll({
      where: { role: roles, is_active: true },
      attributes: ['user_id', 'name', 'role', 'phone', 'is_active'],
      order: [['name', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      data: users.map((user) => ({
        user_id: user.user_id,
        name: user.name,
        role: user.role,
        phone: user.phone || '',
        phone_valid: validatePhoneNumber(user.phone),
        is_active: user.is_active,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load SMS recipients.' });
  }
};

const createFailedBroadcastRecord = async ({ senderUserId, recipient, message, broadcastId, idempotencyKey, error }) => SmsMessage.create({
  sender_user_id: senderUserId,
  recipient_user_id: recipient.user_id,
  recipient_phone: normalizePhoneNumber(recipient.phone || ''),
  message,
  status: 'failed',
  provider: process.env.SMS_PROVIDER || 'lomisend',
  broadcast_id: broadcastId,
  idempotency_key: idempotencyKey,
  error_message: String(error).slice(0, 500),
});

const processBroadcast = async ({ senderUserId, recipientUserIds, message, idempotencyKey }) => {
  const broadcastId = randomUUID();
  const users = await User.findAll({
    where: { user_id: recipientUserIds },
    attributes: ['user_id', 'name', 'role', 'phone', 'is_active'],
  });
  const usersById = new Map(users.map((user) => [user.user_id, user]));
  const records = [];

  for (const recipientUserId of recipientUserIds) {
    const recipient = usersById.get(recipientUserId);
    if (!recipient) {
      records.push({ recipient_user_id: recipientUserId, recipient_phone: '', status: 'failed', provider: process.env.SMS_PROVIDER || 'lomisend', error_message: 'Recipient user not found.' });
      continue;
    }

    if (!recipient.is_active) {
      records.push(await createFailedBroadcastRecord({ senderUserId, recipient, message, broadcastId, idempotencyKey, error: 'Recipient user account is inactive.' }));
      continue;
    }

    if (!validatePhoneNumber(recipient.phone)) {
      records.push(await createFailedBroadcastRecord({ senderUserId, recipient, message, broadcastId, idempotencyKey, error: 'Recipient does not have a valid phone number on file.' }));
      continue;
    }

    try {
      const result = await sendSmsMessage({
        senderUserId,
        recipientUserId: recipient.user_id,
        recipientPhone: recipient.phone,
        message,
        broadcastId,
        idempotencyKey,
      });
      records.push(await SmsMessage.findByPk(result.sms_id, { include: [{ model: User, as: 'recipient', attributes: ['name', 'role'] }] }));
    } catch (error) {
      const failedRecord = await SmsMessage.findOne({ where: { broadcast_id: broadcastId, recipient_user_id: recipient.user_id }, include: [{ model: User, as: 'recipient', attributes: ['name', 'role'] }] });
      records.push(failedRecord || await createFailedBroadcastRecord({ senderUserId, recipient, message, broadcastId, idempotencyKey, error: error.message || 'SMS delivery failed.' }));
    }
  }

  return { broadcast_id: broadcastId, ...summarizeResults(records) };
};

const broadcastSms = async (req, res) => {
  try {
    const { recipientUserIds, message, idempotencyKey } = validateBroadcastPayload(req.body || {});
    const existing = await SmsMessage.findAll({
      where: { idempotency_key: idempotencyKey },
      include: [{ model: User, as: 'recipient', attributes: ['name', 'role'] }],
      order: [['created_at', 'ASC']],
    });
    if (existing.length) {
      return res.status(200).json({ success: true, duplicate: true, data: { broadcast_id: existing[0].broadcast_id, ...summarizeResults(existing) } });
    }

    if (broadcastInFlight.has(idempotencyKey)) {
      const result = await broadcastInFlight.get(idempotencyKey);
      return res.status(200).json({ success: true, duplicate: true, data: result });
    }

    const work = processBroadcast({ senderUserId: req.user.user_id, recipientUserIds, message, idempotencyKey });
    broadcastInFlight.set(idempotencyKey, work);
    try {
      const result = await work;
      await recordAudit(req, { action: 'sms_broadcast_sent', resourceType: 'sms_broadcast', resourceId: result.broadcast_id, details: `Broadcast sent to ${result.total} recipients.` });
      await notifyUsers(req, { type: 'sms_broadcast_result', title: 'SMS broadcast completed', message: `${result.successful} successful, ${result.failed} failed, ${result.queued} queued.`, resourceType: 'sms_broadcast', resourceId: result.broadcast_id, link: '/sms', dedupeKey: `sms-broadcast:${result.broadcast_id}` });
      return res.status(202).json({ success: true, duplicate: false, data: result });
    } finally {
      broadcastInFlight.delete(idempotencyKey);
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to send SMS broadcast.' });
  }
};

const getSmsHistory = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
    const records = await SmsMessage.findAll({
      order: [['created_at', 'DESC']],
      limit,
      include: [
        { model: User, as: 'recipient', attributes: ['name', 'role'] },
        { model: User, as: 'sender', attributes: ['name'] },
      ],
    });
    return res.status(200).json({ success: true, data: records.map((item) => ({ ...summarizeRecord(item), sender_name: item.sender?.name, message: item.message, broadcast_id: item.broadcast_id })) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load SMS history.' });
  }
};

const getPendingSmsForUser = async (req, res) => {
  try {
    const pending = await SmsMessage.findAll({
      where: { recipient_user_id: req.user.user_id, status: 'queued' },
      order: [['created_at', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      data: pending.map((item) => ({
        sms_id: item.sms_id,
        sender_user_id: item.sender_user_id,
        recipient_user_id: item.recipient_user_id,
        recipient_phone: item.recipient_phone,
        message: item.message,
        created_at: item.created_at,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load pending SMS requests.' });
  }
};

const createSmsRequest = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }

    const { recipientUserId, message } = validateSmsPayload(req.body || {});
    const recipient = await User.findByPk(recipientUserId);

    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient user not found.' });
    }

    if (!recipient.is_active) {
      return res.status(400).json({ success: false, message: 'Recipient user account is inactive.' });
    }

    const phoneValue = recipient.phone;
    if (!validatePhoneNumber(phoneValue)) {
      return res.status(400).json({ success: false, message: 'Recipient does not have a valid phone number on file.' });
    }

    const normalizedPhone = normalizePhoneNumber(phoneValue);
    const sanitizedMessage = sanitizeSmsMessage(message);

    try {
      const result = await sendSmsMessage({
        senderUserId: req.user.user_id,
        recipientUserId: recipient.user_id,
        recipientPhone: normalizedPhone,
        message: sanitizedMessage,
      });

      return res.status(202).json({
        success: true,
        message: result?.message || 'SMS queued for delivery to the mobile device.',
        data: {
          sms_id: result.sms_id,
          provider: result.provider,
          recipient: result.recipient,
          status: result.status,
        },
      });
    } catch (error) {
      const message = error.message || 'Failed to queue SMS request.';
      return res.status(500).json({
        success: false,
        message: 'SMS delivery failed. Check the SMS provider configuration and recipient phone number.',
      });
    }
  } catch (error) {
    const message = error.message || 'Failed to queue SMS request.';
    return res.status(400).json({ success: false, message });
  }
};

const updateSmsStatusByRecipient = async (req, res) => {
  try {
    const { smsId } = req.params;
    const { status, message } = req.body || {};
    const allowedStatuses = ['sent', 'failed', 'delivered', 'expired'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid SMS status.' });
    }

    const smsRecord = await SmsMessage.findByPk(smsId);
    if (!smsRecord) {
      return res.status(404).json({ success: false, message: 'SMS record not found.' });
    }

    if (smsRecord.recipient_user_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not allowed to update this SMS receipt.' });
    }

    await smsRecord.update({
      status,
      error_message: status === 'failed' ? (message || 'SMS send failed') : null,
      sent_at: status === 'sent' || status === 'delivered' ? new Date() : smsRecord.sent_at,
    });

    return res.status(200).json({ success: true, data: smsRecord.toJSON() });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update SMS status.' });
  }
};

module.exports = {
  broadcastSms,
  createSmsRequest,
  getAdminSmsRecipients,
  getPendingSmsForUser,
  getSmsHistory,
  updateSmsStatusByRecipient,
};
