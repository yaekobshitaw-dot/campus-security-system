const developmentOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5175',
  'http://localhost:5175'
];

const configuredOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = configuredOrigins.length > 0
  ? configuredOrigins
  : process.env.NODE_ENV === 'production'
    ? []
    : developmentOrigins;

const isAllowedOrigin = (origin) => !origin || allowedOrigins.includes(origin);

const corsOrigin = (origin, callback) => {
  if (isAllowedOrigin(origin)) {
    return callback(null, true);
  }

  return callback(new Error('Origin is not allowed by CORS'));
};

module.exports = { allowedOrigins, corsOrigin, isAllowedOrigin };
