const { Op } = require('sequelize');
const { Announcement, AnnouncementAudience, AnnouncementRead, sequelize } = require('../models');
const {
  ANNOUNCEMENT_ROLES,
  AnnouncementValidationError,
  validateAnnouncementId,
  validateAnnouncementPayload
} = require('../validators/announcementValidator');

const managementRoles = new Set(['admin']);

const isAdmin = (user) => user?.role === 'admin';

const announcementInclude = (user, includeRead = true) => [
  {
    model: AnnouncementAudience,
    as: 'audiences',
    attributes: ['role'],
    required: !isAdmin(user),
    ...(isAdmin(user) ? {} : { where: { role: user.role } })
  },
  ...(includeRead ? [{
    model: AnnouncementRead,
    as: 'reads',
    attributes: ['read_at'],
    required: false,
    where: { user_id: user.user_id }
  }] : [])
];

const lifecycleWhere = (user) => {
  const where = { deleted_at: null };
  if (!isAdmin(user)) {
    where.status = 'published';
    where[Op.or] = [
      { expires_at: null },
      { expires_at: { [Op.gt]: new Date() } }
    ];
  }
  return where;
};

const toSafeAnnouncement = (announcement) => {
  const value = typeof announcement.toJSON === 'function' ? announcement.toJSON() : announcement;
  const audiences = Array.isArray(value.audiences) ? value.audiences.map((audience) => audience.role) : [];
  const read = Array.isArray(value.reads) && value.reads.length ? value.reads[0] : null;
  return {
    announcement_id: value.announcement_id,
    title: value.title,
    content: value.content,
    priority: value.priority,
    status: value.status,
    target_roles: audiences,
    created_at: value.created_at,
    updated_at: value.updated_at,
    published_at: value.published_at,
    expires_at: value.expires_at,
    is_read: Boolean(read?.read_at),
    read_at: read?.read_at || null
  };
};

const getAnnouncementRecord = async (user, announcementId, transaction) => {
  validateAnnouncementId(announcementId);
  const options = {
    where: { announcement_id: announcementId, ...lifecycleWhere(user) },
    include: announcementInclude(user),
    order: [[{ model: AnnouncementAudience, as: 'audiences' }, 'role', 'ASC']]
  };
  if (transaction) options.transaction = transaction;
  return Announcement.findOne(options);
};

const createAnnouncement = async (user, payload) => {
  const values = validateAnnouncementPayload(payload, { partial: false });
  if (values.status && values.status !== 'draft') {
    throw new AnnouncementValidationError('Announcements must be created as drafts');
  }

  return sequelize.transaction(async (transaction) => {
    const announcement = await Announcement.create({
      title: values.title,
      content: values.content,
      priority: values.priority,
      status: 'draft',
      created_by: user.user_id,
      updated_by: user.user_id,
      expires_at: values.expires_at || null
    }, { transaction });

    if (values.target_roles?.length) {
      await AnnouncementAudience.bulkCreate(values.target_roles.map((role) => ({
        announcement_id: announcement.announcement_id,
        role
      })), { transaction });
    }

    return getAnnouncementRecord(user, announcement.announcement_id, transaction);
  });
};

const updateAnnouncement = async (user, announcementId, payload) => {
  const values = validateAnnouncementPayload(payload, { partial: true });
  if (values.status === 'published') {
    throw new AnnouncementValidationError('Use the publish endpoint to publish an announcement');
  }

  return sequelize.transaction(async (transaction) => {
    const announcement = await Announcement.findOne({
      where: { announcement_id: validateAnnouncementId(announcementId), deleted_at: null }
    });
    if (!announcement) return null;

    const updateValues = {
      ...Object.fromEntries(['title', 'content', 'priority', 'expires_at', 'status'].filter((field) => values[field] !== undefined).map((field) => [field, values[field]])),
      updated_by: user.user_id
    };
    if (updateValues.status === 'draft') updateValues.published_at = null;
    await announcement.update(updateValues, { transaction });

    if (values.target_roles !== undefined) {
      await AnnouncementAudience.destroy({ where: { announcement_id: announcement.announcement_id }, transaction });
      if (values.target_roles.length) {
        await AnnouncementAudience.bulkCreate(values.target_roles.map((role) => ({
          announcement_id: announcement.announcement_id,
          role
        })), { transaction });
      }
    }

    const refreshed = await getAnnouncementRecord(user, announcement.announcement_id, transaction);
    return refreshed;
  });
};

const publishAnnouncement = async (user, announcementId) => {
  return sequelize.transaction(async (transaction) => {
    const announcement = await Announcement.findOne({
      where: { announcement_id: validateAnnouncementId(announcementId), deleted_at: null }
    });
    if (!announcement) return null;

    const audiences = await AnnouncementAudience.findAll({
      where: { announcement_id: announcement.announcement_id },
      attributes: ['role'],
      transaction
    });
    const roles = audiences.map((audience) => audience.role);
    if (!roles.length || roles.some((role) => !ANNOUNCEMENT_ROLES.includes(role))) {
      throw new AnnouncementValidationError('At least one valid target role is required before publishing');
    }
    if (announcement.expires_at && new Date(announcement.expires_at) <= new Date()) {
      throw new AnnouncementValidationError('An announcement cannot be published after its expiry');
    }

    await announcement.update({ status: 'published', published_at: new Date(), updated_by: user.user_id }, { transaction });
    return getAnnouncementRecord(user, announcement.announcement_id, transaction);
  });
};

const unpublishAnnouncement = async (user, announcementId) => {
  const announcement = await Announcement.findOne({
    where: { announcement_id: validateAnnouncementId(announcementId), deleted_at: null }
  });
  if (!announcement) return null;
  await announcement.update({ status: 'unpublished', updated_by: user.user_id });
  return getAnnouncementRecord(user, announcement.announcement_id);
};

const deleteAnnouncement = async (user, announcementId) => {
  const announcement = await Announcement.findOne({
    where: { announcement_id: validateAnnouncementId(announcementId), deleted_at: null }
  });
  if (!announcement) return null;
  await announcement.update({ deleted_at: new Date(), updated_by: user.user_id });
  return announcement;
};

const listAnnouncements = async (user) => {
  const announcements = await Announcement.findAll({
    where: lifecycleWhere(user),
    include: announcementInclude(user),
    order: [['published_at', 'DESC'], ['created_at', 'DESC']]
  });
  return announcements.map(toSafeAnnouncement);
};

const getAnnouncement = async (user, announcementId) => {
  const announcement = await getAnnouncementRecord(user, announcementId);
  return announcement ? toSafeAnnouncement(announcement) : null;
};

const markAnnouncementRead = async (user, announcementId) => {
  const announcement = await getAnnouncementRecord(user, announcementId);
  if (!announcement) return null;

  const [read] = await AnnouncementRead.findOrCreate({
    where: { announcement_id: announcement.announcement_id, user_id: user.user_id },
    defaults: { read_at: new Date() }
  });
  if (!read.read_at) await read.update({ read_at: new Date() });
  return { announcement_id: announcement.announcement_id, is_read: true, read_at: read.read_at };
};

const getUnreadCount = async (user) => {
  const announcements = await Announcement.findAll({
    where: lifecycleWhere(user),
    include: announcementInclude(user),
    attributes: ['announcement_id']
  });
  return announcements.reduce((count, announcement) => {
    const value = typeof announcement.toJSON === 'function' ? announcement.toJSON() : announcement;
    const read = Array.isArray(value.reads) && value.reads.length ? value.reads[0] : null;
    return count + (read?.read_at ? 0 : 1);
  }, 0);
};

module.exports = {
  managementRoles,
  toSafeAnnouncement,
  listAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  unpublishAnnouncement,
  deleteAnnouncement,
  markAnnouncementRead,
  getUnreadCount
};
