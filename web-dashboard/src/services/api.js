import axios from 'axios';
import { consumePendingAction } from '../utils/actionConfirmation';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/?$/, '');

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000
});

api.interceptors.request.use(
  (config) => {
    const action = consumePendingAction();
    if (action) config.actionConfirmation = action;
    const token = localStorage.getItem('token');
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers?.['Content-Type'];
      delete config.headers?.['content-type'];
    }
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = ['Bearer', token].join(' ');
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    const action = response.config.actionConfirmation;
    if (action) {
      window.dispatchEvent(new CustomEvent('campus-security:action-succeeded', {
        detail: action,
      }));
    }
    return response;
  },
  (error) => {
    if (['SYSTEM_DEACTIVATED', 'SYSTEM_STATUS_UNAVAILABLE'].includes(error.response?.data?.code)) {
      window.dispatchEvent(new CustomEvent('campus-security:system-status', {
        detail: { active: error.response.data.code === 'SYSTEM_DEACTIVATED' ? false : null },
      }));
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent('campus-security:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
