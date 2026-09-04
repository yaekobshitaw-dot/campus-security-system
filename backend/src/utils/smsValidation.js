const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizePhoneNumber = (value = '') => {
  const input = String(value ?? '').trim();
  if (!input) return '';

  const cleaned = input.replace(/[^\d+]/g, '');
  if (!cleaned) return '';

  const digitsOnly = cleaned.replace(/\+/g, '');
  if (cleaned.startsWith('+')) return `+${digitsOnly}`;
  return digitsOnly;
};

const toE164 = (value = '') => {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return '';

  if (normalized.startsWith('+')) {
    const e164 = normalized.replace(/\D/g, '');
    if (/^251[79]\d{8}$/.test(e164)) return `+${e164}`;
    if (/^\d{10,15}$/.test(e164)) return `+${e164}`;
    return normalized;
  }

  const digits = normalized.replace(/\D/g, '');
  if (/^251[79]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[79]\d{8}$/.test(digits)) return `+251${digits.slice(1)}`;
  if (/^[79]\d{8}$/.test(digits)) return `+251${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;

  return normalized;
};

const validatePhoneNumber = (value = '') => {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return false;
  const e164 = toE164(normalized);
  return /^\+[1-9]\d{7,14}$/.test(e164);
};

const sanitizeSmsMessage = (value = '') => {
  const sanitized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!sanitized) return '';
  return sanitized.slice(0, 1600);
};

const validateSmsPayload = ({ recipientUserId, message }) => {
  if (!recipientUserId || !UUID_REGEX.test(String(recipientUserId))) {
    throw new Error('A valid recipient user ID is required.');
  }

  const sanitizedMessage = sanitizeSmsMessage(message);
  if (!sanitizedMessage) {
    throw new Error('Message cannot be empty.');
  }

  if (sanitizedMessage.length > 1600) {
    throw new Error('Message exceeds the 1600 character limit.');
  }

  return { recipientUserId: String(recipientUserId), message: sanitizedMessage };
};

module.exports = {
  normalizePhoneNumber,
  toE164,
  validatePhoneNumber,
  sanitizeSmsMessage,
  validateSmsPayload,
};
