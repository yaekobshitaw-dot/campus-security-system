const { Notification, User } = require('../models');

const createNotification = async ({ userId, type, title, message, resourceType = null, resourceId = null, link = null, data = null, dedupeKey }) => {
  if (!userId || !dedupeKey) return null;
  try {
    const [notification] = await Notification.findOrCreate({
      where: { dedupe_key: dedupeKey },
      defaults: { user_id: userId, type, title, message, resource_type: resourceType, resource_id: resourceId, link, data },
    });
    return notification;
  } catch {
    return null;
  }
};

const notifyUsers = async (req, payload, users = null) => {
  let recipients = users;
  try {
    recipients = recipients || await User.findAll({ where: { is_active: true, role: ['admin', 'security'] }, attributes: ['user_id'] });
  } catch {
    return [];
  }
  const io = req.app?.get('io');
  const created = [];
  for (const user of recipients) {
    const notification = await createNotification({ ...payload, userId: user.user_id, dedupeKey: `${payload.dedupeKey}:${user.user_id}` });
    if (notification) {
      created.push(notification);
      if (io) io.to(`user:${user.user_id}`).emit('notification-created', notification.toJSON ? notification.toJSON() : notification);
    }
  }
  return created;
};

module.exports = { createNotification, notifyUsers };
