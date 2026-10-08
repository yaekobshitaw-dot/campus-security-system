import axios from 'axios';
import { consumePendingAction } from '../utils/actionConfirmation';

const API_URL = (
    import.meta.env.VITE_API_URL || '/api').replace(/\/?$/, '');
let refreshRequest = null;

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
});

api.interceptors.request.use(
    (config) => {
        if (!config.actionConfirmation) {
            const action = consumePendingAction();
            if (action) config.actionConfirmation = action;
        }
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
    async(error) => {
        if (['SYSTEM_DEACTIVATED', 'SYSTEM_STATUS_UNAVAILABLE'].includes(error.response?.data?.code)) {
            window.dispatchEvent(new CustomEvent('campus-security:system-status', {
                detail: { active: error.response.data.code === 'SYSTEM_DEACTIVATED' ? false : null },
            }));
        }
        const originalRequest = error.config || {};
        const isRefreshRequest = String(originalRequest.url || '').includes('/auth/refresh');
        if (error.response?.status === 401 && !isRefreshRequest && !originalRequest._retry) {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                originalRequest._retry = true;
                refreshRequest || = axios.post(`${API_URL}/auth/refresh`, { refreshToken }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: api.defaults.timeout
                }).then((response) => {
                    const data = response.data?.data || {};
                    if (!data.accessToken || !data.refreshToken) throw new Error('Refresh response is incomplete');
                    localStorage.setItem('token', data.accessToken);
                    localStorage.setItem('refreshToken', data.refreshToken);
                    if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
                    return data.accessToken;
                }).finally(() => {
                    refreshRequest = null;
                });
                try {
                    const accessToken = await refreshRequest;
                    originalRequest.headers = originalRequest.headers || {};
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return api(originalRequest);
                } catch {
                    // Fall through to the existing unauthorized event when rotation fails.
                }
            }
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            window.dispatchEvent(new CustomEvent('campus-security:unauthorized'));
        }
        return Promise.reject(error);
    }
);

export default api;