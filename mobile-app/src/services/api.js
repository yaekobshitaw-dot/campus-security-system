import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';
import { getApiBaseUrl } from '../config/server';
import { socketService } from './socket';

let authInvalidationHandler = null;
let pendingLogoutRefreshToken = null;

export const setLogoutRefreshToken = (refreshToken) => {
  pendingLogoutRefreshToken = typeof refreshToken === 'string' && refreshToken
    ? refreshToken
    : null;
};

export const consumeLogoutRefreshToken = () => {
  const refreshToken = pendingLogoutRefreshToken;
  pendingLogoutRefreshToken = null;
  return refreshToken;
};

export const setAuthInvalidationHandler = (handler) => {
  authInvalidationHandler = handler;

  return () => {
    if (authInvalidationHandler === handler) {
      authInvalidationHandler = null;
    }
  };
};

export const clearAuthSession = async () => {
  pendingLogoutRefreshToken = null;
  await Promise.all(['auth_token', 'refresh_token', 'user'].map(async (key) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear stored auth session:', error);
    }
  }));

  socketService.disconnect();
};

const API_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Platform': Platform.OS,
  },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (config.data instanceof FormData && config.headers) {
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await clearAuthSession();
      authInvalidationHandler?.();
    }
    return Promise.reject(error);
  }
);

export { api };
export default api;
