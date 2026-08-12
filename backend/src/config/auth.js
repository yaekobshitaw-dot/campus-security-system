const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'change_me',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'change_me_refresh',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
};
