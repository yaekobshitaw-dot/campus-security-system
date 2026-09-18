const announcementService = require('../services/announcementService');
const { AnnouncementValidationError } = require('../validators/announcementValidator');
const { recordAudit } = require('../services/auditService');
const { notifyUsers } = require('../services/notificationPersistence');

const sendError = (res, error, fallbackMessage) => {
  if (error instanceof AnnouncementValidationError) {
    return res.status(400).json({ success: false, message: error.message });
  }
  return res.status(500).json({ success: false, message: fallbackMessage });
};

exports.list = async (req, res) => {
  try {
    const data = await announcementService.listAnnouncements(req.user);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Unable to load announcements');
  }
};

exports.publicList = async (req, res) => {
  try {
    const { Announcement } = require('../models');
    const { Op } = require('sequelize');
    const data = await Announcement.findAll({
      where: { status: 'published', is_public: true, deleted_at: null, [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }] },
      attributes: ['announcement_id', 'title', 'content', 'priority', 'published_at', 'expires_at'],
      order: [['published_at', 'DESC']],
      limit: 20,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load public announcements' });
  }
};

exports.getById = async (req, res) => {
  try {
    const data = await announcementService.getAnnouncement(req.user, req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Announcement not found' });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Unable to load announcement');
  }
};

exports.create = async (req, res) => {
  try {
    const data = await announcementService.createAnnouncement(req.user, req.body);
    await recordAudit(req, { action: 'announcement_created', resourceType: 'announcement', resourceId: data?.announcement_id });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Unable to create announcement');
  }
};

exports.update = async (req, res) => {
  try {
    const data = await announcementService.updateAnnouncement(req.user, req.params.id, req.body);
    if (!data) return res.status(404).json({ success: false, message: 'Announcement not found' });
    await recordAudit(req, { action: 'announcement_updated', resourceType: 'announcement', resourceId: req.params.id });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Unable to update announcement');
  }
};

exports.remove = async (req, res) => {
  try {
    const data = await announcementService.deleteAnnouncement(req.user, req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Announcement not found' });
    await recordAudit(req, { action: 'announcement_deleted', resourceType: 'announcement', resourceId: req.params.id });
    return res.status(200).json({ success: true, data: { announcement_id: data.announcement_id } });
  } catch (error) {
    return sendError(res, error, 'Unable to delete announcement');
  }
};

exports.publish = async (req, res) => {
  try {
    const data = await announcementService.publishAnnouncement(req.user, req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Announcement not found' });
    await recordAudit(req, { action: 'announcement_published', resourceType: 'announcement', resourceId: req.params.id });
    await notifyUsers(req, { type: 'announcement_published', title: 'New campus announcement', message: data.title, resourceType: 'announcement', resourceId: req.params.id, link: '/announcements', dedupeKey: `announcement-published:${req.params.id}:${data.published_at}` });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Unable to publish announcement');
  }
};

exports.unpublish = async (req, res) => {
  try {
    const data = await announcementService.unpublishAnnouncement(req.user, req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Announcement not found' });
    await recordAudit(req, { action: 'announcement_unpublished', resourceType: 'announcement', resourceId: req.params.id });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Unable to unpublish announcement');
  }
};

exports.markRead = async (req, res) => {
  try {
    const data = await announcementService.markAnnouncementRead(req.user, req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Announcement not found' });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Unable to mark announcement as read');
  }
};

exports.unreadCount = async (req, res) => {
  try {
    const count = await announcementService.getUnreadCount(req.user);
    return res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    return sendError(res, error, 'Unable to load announcement unread count');
  }
};
