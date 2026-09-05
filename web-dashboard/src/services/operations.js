import api from './api';

export const readAlert = (alertId) => api.put(`/alerts/${alertId}/read`);
