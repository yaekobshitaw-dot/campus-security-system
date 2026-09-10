import api from './api';

export const fetchAnnouncementsRequest = () => api.get('/announcements');
export const fetchAnnouncementRequest = (announcementId) => api.get(`/announcements/${announcementId}`);
export const markAnnouncementReadRequest = (announcementId) => api.put(`/announcements/${announcementId}/read`);
export const fetchAnnouncementUnreadCountRequest = () => api.get('/announcements/unread-count');
