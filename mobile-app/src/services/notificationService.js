import api from './api';

export const fetchNotificationsRequest = () => api.get('/notifications');
export const markNotificationReadRequest = (notificationId) => api.patch(`/notifications/${notificationId}/read`);
export const markAllNotificationsReadRequest = () => api.patch('/notifications/read-all');
