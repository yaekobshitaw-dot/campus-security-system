const { User, SmsMessage } = require('../models');
const { sendSmsMessage } = require('../services/smsService');
const { validateSmsPayload, validatePhoneNumber, normalizePhoneNumber, sanitizeSmsMessage } = require('../utils/smsValidation');

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

module.exports = { createSmsRequest, getPendingSmsForUser, updateSmsStatusByRecipient };
