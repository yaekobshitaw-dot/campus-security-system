export const getAnnouncementDetailFields = (announcement = {}) => ({
  title: announcement.title || 'Announcement',
  content: announcement.content || 'No announcement content is available.',
  priority: announcement.priority || 'medium',
  publishedAt: announcement.published_at || null,
  expiresAt: announcement.expires_at || null,
  isRead: Boolean(announcement.is_read),
});
