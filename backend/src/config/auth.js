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
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
};
