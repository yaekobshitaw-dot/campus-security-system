const jwt = require('jsonwebtoken');
const { User } = require('../models');

const jwtSecret = process.env.JWT_SECRET;

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme === 'Bearer' && token) {
    return token;
  }

  return null;
};

const authenticate = async (req, res, next) => {
  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!jwtSecret) {
      return res.status(500).json({ success: false, message: 'Authentication is not configured correctly' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findByPk(decoded.user_id);

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = user;
    return next();
  } catch (error) {
    const message = error.name === 'TokenExpiredError'
      ? 'Token expired. Please log in again.'
      : 'Invalid token';

    return res.status(401).json({ success: false, message });
  }
};

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
  }

  return next();
};

module.exports = { authenticate, authorize };
