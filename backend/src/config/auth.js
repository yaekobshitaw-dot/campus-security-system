const dotenv = require('dotenv');
dotenv.config();

const requiredSecret = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} must be configured in the environment before authentication can start.`);
  }
  return value;
};

module.exports = {
  jwtSecret: requiredSecret('JWT_SECRET'),
  refreshTokenSecret: requiredSecret('REFRESH_TOKEN_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  lomisendApiKey: process.env.LOMISEND_API_KEY || '',
  lomisendSenderId: process.env.LOMISEND_SENDER_ID || '',
  lomisendTimeoutMs: Number(process.env.LOMISEND_TIMEOUT_MS || 20000),
};
