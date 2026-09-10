const announcementService = require('../services/announcementService');
const { AnnouncementValidationError } = require('../validators/announcementValidator');

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
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Unable to create announcement');
  }
};

exports.update = async (req, res) => {
  try {
    const data = await announcementService.updateAnnouncement(req.user, req.params.id, req.body);
    if (!data) return res.status(404).json({ success: false, message: 'Announcement not found' });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Unable to update announcement');
  }
};

exports.remove = async (req, res) => {
  try {
    const data = await announcementService.deleteAnnouncement(req.user, req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Announcement not found' });
    return res.status(200).json({ success: true, data: { announcement_id: data.announcement_id } });
  } catch (error) {
    return sendError(res, error, 'Unable to delete announcement');
  }
};

exports.publish = async (req, res) => {
  try {
    const data = await announcementService.publishAnnouncement(req.user, req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Announcement not found' });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Unable to publish announcement');
  }
};

exports.unpublish = async (req, res) => {
  try {
    const data = await announcementService.unpublishAnnouncement(req.user, req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Announcement not found' });
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
