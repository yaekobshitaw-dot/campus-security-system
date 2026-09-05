const SERVER_CONFIG = {
  development: {
    apiBaseUrl: 'http://localhost:5000/api',
    socketBaseUrl: 'http://localhost:5000',
  },
  production: {
    apiBaseUrl: 'https://api.yourdomain.com/api',
    socketBaseUrl: 'wss://api.yourdomain.com',
  },
};

export const getApiBaseUrl = () => {
  const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL || globalThis.__APP_API_BASE_URL__;
  if (configuredApiUrl) {
    return configuredApiUrl;
  }

  return __DEV__ ? SERVER_CONFIG.development.apiBaseUrl : SERVER_CONFIG.production.apiBaseUrl;
};

export const getServerBaseUrl = () => {
  const apiBaseUrl = getApiBaseUrl();
  return apiBaseUrl.replace(/\/api$/, '');
};

export const getDerivedSocketUrl = () => {
  const configuredSocketUrl = process.env.EXPO_PUBLIC_WS_URL || globalThis.__APP_SOCKET_BASE_URL__;
  if (configuredSocketUrl) {
    return configuredSocketUrl;
  }

  const serverBaseUrl = getServerBaseUrl();
  if (serverBaseUrl.startsWith('https://')) {
    return serverBaseUrl.replace(/^https:/, 'wss:');
  }

  if (serverBaseUrl.startsWith('http://')) {
    return serverBaseUrl.replace(/^http:/, 'ws:');
  }

  return __DEV__ ? SERVER_CONFIG.development.socketBaseUrl : SERVER_CONFIG.production.socketBaseUrl;
};

export const getSocketBaseUrl = () => getDerivedSocketUrl();

export default SERVER_CONFIG;
