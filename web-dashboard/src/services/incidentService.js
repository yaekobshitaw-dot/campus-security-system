import api from './api';

export const incidentService = {
  getAll: async () => {
    const response = await api.get('/incidents');
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/incidents/stats');
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/incidents', data);
    return response.data;
  }
};

export default incidentService;
