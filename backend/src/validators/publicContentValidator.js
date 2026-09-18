const { validate: isUuid } = require('uuid');
const { CONTENT_TYPES } = require('../models/PublicContent');

const normalize = (value, field, maxLength, required = false) => {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const text = value.trim();
  if (required && !text) throw new Error(`${field} is required`);
  if (text.length > maxLength) throw new Error(`${field} must be ${maxLength} characters or fewer`);
  return text || null;
};

const validatePublicContentPayload = (payload = {}, { partial = false } = {}) => {
  const values = {};
  if (!partial || payload.type !== undefined) {
    if (!CONTENT_TYPES.includes(payload.type)) throw new Error(`type must be one of: ${CONTENT_TYPES.join(', ')}`);
    values.type = payload.type;
  }
  if (!partial || payload.title !== undefined) values.title = normalize(payload.title, 'title', 255, true);
  for (const field of ['summary', 'body', 'contact_name', 'phone', 'email', 'url']) {
    if (payload[field] !== undefined) values[field] = normalize(payload[field], field, field === 'body' ? 10000 : field === 'url' ? 1000 : 1000);
  }
  if (payload.priority !== undefined) {
    const priority = Number(payload.priority);
    if (!Number.isInteger(priority) || priority < 0 || priority > 9999) throw new Error('priority must be a whole number from 0 to 9999');
    values.priority = priority;
  }
  if (payload.is_active !== undefined) {
    if (typeof payload.is_active !== 'boolean') throw new Error('is_active must be a boolean');
    values.is_active = payload.is_active;
  }
  if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) throw new Error('email must be valid');
  if (payload.content_id !== undefined && !isUuid(payload.content_id)) throw new Error('content_id is invalid');
  return values;
};

module.exports = { validatePublicContentPayload };
