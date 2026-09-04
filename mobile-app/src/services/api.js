import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';
import { getApiBaseUrl } from '../config/server';
import { socketService } from './socket';

export const clearAuthSession = async () => {
  try {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user');
  } catch (error) {
    console.warn('Failed to clear stored auth session:', error);
  }

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
  if (__DEV__) {
    console.warn('API request:', config.method?.toUpperCase(), `${config.baseURL || ''}${config.url || ''}`);
  }
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
    }
    return Promise.reject(error);
  }
);

export { api };
export default api;
