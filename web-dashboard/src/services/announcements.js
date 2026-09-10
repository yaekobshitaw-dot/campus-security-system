import api from './api';

export const listAnnouncements = () => api.get('/announcements');
export const getAnnouncement = (announcementId) => api.get(`/announcements/${announcementId}`);
export const createAnnouncement = (payload) => api.post('/announcements', payload);
export const updateAnnouncement = (announcementId, payload) => api.patch(`/announcements/${announcementId}`, payload);
export const deleteAnnouncement = (announcementId) => api.delete(`/announcements/${announcementId}`);
export const publishAnnouncement = (announcementId) => api.post(`/announcements/${announcementId}/publish`);
export const unpublishAnnouncement = (announcementId) => api.post(`/announcements/${announcementId}/unpublish`);
export const markAnnouncementRead = (announcementId) => api.put(`/announcements/${announcementId}/read`);
export const getAnnouncementUnreadCount = () => api.get('/announcements/unread-count');
