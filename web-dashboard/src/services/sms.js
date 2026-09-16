import api from './api';

export const listSmsRecipients = (role = 'all') => api.get('/sms/recipients', { params: { role } });
export const sendSmsBroadcast = (payload) => api.post('/sms/broadcast', payload);
export const listSmsHistory = () => api.get('/sms/history');
