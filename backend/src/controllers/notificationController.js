const { Notification } = require('../models');
const { recordAudit } = require('../services/auditService');

exports.list = async (req, res) => {
  try {
    const items = await Notification.findAll({
      where: { user_id: req.user.user_id },
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error('Unable to load notifications:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Unable to load notifications' });
  }
};

exports.clearHistory = async (req, res) => {
  try {
    const deletedCount = await Notification.destroy({
      where: { user_id: req.user.user_id },
    });
    await recordAudit(req, {
      action: 'notification_history_cleared',
      resourceType: 'notification',
      details: `User ${req.user.user_id} cleared their notification history.`,
    });
    return res.status(200).json({
      success: true,
      message: 'Notification history cleared successfully',
      data: { deleted_count: deletedCount },
    });
  } catch (error) {
    console.error('Unable to clear notification history:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Unable to clear notification history' });
  }
};

exports.markRead = async (req, res) => {
  try {
    const item = await Notification.findOne({ where: { notification_id: req.params.id, user_id: req.user.user_id } });
    if (!item) return res.status(404).json({ success: false, message: 'Notification not found' });
    await item.update({ is_read: true });
    await recordAudit(req, { action: 'notification_marked_read', resourceType: 'notification', resourceId: item.notification_id });
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error('Unable to mark notification read:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Unable to mark notification as read' });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await Notification.update({ is_read: true }, { where: { user_id: req.user.user_id, is_read: false } });
    await recordAudit(req, { action: 'notifications_marked_read', resourceType: 'notification', details: `User ${req.user.user_id} marked all notifications read.` });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Unable to mark all notifications read:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Unable to mark notifications as read' });
  }
};
