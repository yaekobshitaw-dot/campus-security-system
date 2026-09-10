const SERVER_CONFIG = {
  development: {
    apiBaseUrl: globalThis.__APP_API_BASE_URL__ || 'http://172.16.37.45:5002/api',
    socketBaseUrl: globalThis.__APP_SOCKET_BASE_URL__ || 'http://127.0.0.1:5002',
  },
  production: {
    apiBaseUrl: globalThis.__APP_API_BASE_URL__ || 'https://api.yourdomain.com/api',
    socketBaseUrl: globalThis.__APP_SOCKET_BASE_URL__ || 'wss://api.yourdomain.com',
  },
};

export const getApiBaseUrl = () => {
  const configuredApiUrl = globalThis.__APP_API_BASE_URL__;
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
  const configuredSocketUrl = globalThis.__APP_SOCKET_BASE_URL__;
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
