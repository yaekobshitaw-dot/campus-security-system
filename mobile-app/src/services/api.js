import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';

const getBaseURL = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5000/api';
    }
    return 'http://localhost:5000/api';
  }
  return 'https://api.yourdomain.com/api';
};

const API_URL = process.env.API_URL || getBaseURL();

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
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        const response = await api.post('/auth/refresh', { refreshToken });
        const { token } = response.data.data;
        await AsyncStorage.setItem('auth_token', token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        await AsyncStorage.clear();
        // Navigate to login (handled in App.js)
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export { api };
export default api;