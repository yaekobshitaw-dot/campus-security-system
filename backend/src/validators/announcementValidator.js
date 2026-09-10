const { validate: isUuid } = require('uuid');

const ANNOUNCEMENT_ROLES = ['student', 'faculty', 'staff', 'security', 'admin'];
const ANNOUNCEMENT_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const ANNOUNCEMENT_STATUSES = ['draft', 'published', 'unpublished'];
const MAX_TITLE_LENGTH = 255;
const MAX_CONTENT_LENGTH = 10000;

class AnnouncementValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnnouncementValidationError';
    this.statusCode = 400;
  }
}

const normalizeText = (value, field, maxLength, required) => {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string') throw new AnnouncementValidationError(`${field} must be a string`);
  const normalized = value.trim();
  if (required && !normalized) throw new AnnouncementValidationError(`${field} is required`);
  if (normalized.length > maxLength) throw new AnnouncementValidationError(`${field} must be ${maxLength} characters or fewer`);
  return normalized;
};

const normalizeAudience = (value, required) => {
  if (value === undefined && !required) return undefined;
  if (!Array.isArray(value)) throw new AnnouncementValidationError('target_roles must be an array');
  const roles = [...new Set(value)];
  if (required && roles.length === 0) throw new AnnouncementValidationError('At least one target role is required');
  if (roles.some((role) => typeof role !== 'string' || !ANNOUNCEMENT_ROLES.includes(role))) {
    throw new AnnouncementValidationError('target_roles contains an unknown role');
  }
  return roles;
};

const normalizeDate = (value, field) => {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AnnouncementValidationError(`${field} must be a valid date`);
  return date;
};

const validateAnnouncementPayload = (payload = {}, { partial = false, requireAudience = false } = {}) => {
  const values = {};
  if (!partial || payload.title !== undefined) values.title = normalizeText(payload.title, 'title', MAX_TITLE_LENGTH, true);
  if (!partial || payload.content !== undefined) values.content = normalizeText(payload.content, 'content', MAX_CONTENT_LENGTH, true);

  if (!partial || payload.priority !== undefined) {
    const priority = payload.priority === undefined ? 'medium' : payload.priority;
    if (!ANNOUNCEMENT_PRIORITIES.includes(priority)) throw new AnnouncementValidationError('priority is invalid');
    values.priority = priority;
  }

  if (payload.status !== undefined) {
    if (!ANNOUNCEMENT_STATUSES.includes(payload.status)) throw new AnnouncementValidationError('status is invalid');
    values.status = payload.status;
  }

  if (!partial || payload.target_roles !== undefined || requireAudience) {
    values.target_roles = normalizeAudience(payload.target_roles, requireAudience);
  }

  if (payload.expires_at !== undefined) values.expires_at = normalizeDate(payload.expires_at, 'expires_at');
  if (payload.published_at !== undefined) values.published_at = normalizeDate(payload.published_at, 'published_at');

  if (payload.announcement_id !== undefined && !isUuid(payload.announcement_id)) {
    throw new AnnouncementValidationError('announcement_id is invalid');
  }

  return values;
};

const validateAnnouncementId = (value) => {
  if (!isUuid(value)) throw new AnnouncementValidationError('announcement_id is invalid');
  return value;
};

module.exports = {
  ANNOUNCEMENT_ROLES,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_STATUSES,
  MAX_TITLE_LENGTH,
  MAX_CONTENT_LENGTH,
  AnnouncementValidationError,
  validateAnnouncementId,
  validateAnnouncementPayload
};
