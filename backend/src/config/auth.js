const dotenv = require('dotenv');
dotenv.config();

const requiredSecret = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    // In production, fail fast. In development or test, allow startup but warn so the app can run without auth secrets set.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`${name} must be configured in the environment before authentication can start.`);
    }
    console.warn(`${name} is not set. Continuing in non-production mode; authentication features may be limited.`);
    return '';
  }
  return value;
};

module.exports = {
  jwtSecret: requiredSecret('JWT_SECRET'),
  refreshTokenSecret: requiredSecret('REFRESH_TOKEN_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  lomisendApiKey: process.env.LOMISEND_API_KEY || '',
  lomisendProjectId: process.env.LOMISEND_PROJECT_ID || '',
  lomisendSenderId: process.env.LOMISEND_SENDER_ID || '',
  lomisendTimeoutMs: Number(process.env.LOMISEND_TIMEOUT_MS || 20000),
};
