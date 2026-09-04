const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000;
const message = 'Too many requests from this IP, please try again later.';

const createLimiter = (max) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message
});

const apiLimiter = createLimiter(parseInt(process.env.API_RATE_LIMIT_MAX, 10) || 1000);
const authLimiter = createLimiter(parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || parseInt(process.env.RATE_LIMIT_MAX, 10) || 100);

module.exports = { apiLimiter, authLimiter };
