const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { SecuritySession, User } = require('../models');
const { isSystemActive } = require('../services/settingsService');

const normalizeRole = (role) => String(role || '').trim().toLowerCase();
const isAllowedRole = (role, allowedRoles) => allowedRoles.some((candidate) => normalizeRole(role) === normalizeRole(candidate));

const jwtSecret = process.env.JWT_SECRET;

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme === 'Bearer' && token) {
    return token;
  }

  return null;
};

const getAuthenticatedUser = async(req) => {
  const token = getTokenFromHeader(req);
  if (!token) throw new Error('Authentication required');
  if (!jwtSecret) throw new Error('Authentication is not configured correctly');

  const decoded = jwt.verify(token, jwtSecret);
  if (!decoded.user_id || !decoded.sid) throw new Error('Invalid token');
  const user = await User.findByPk(decoded.user_id);
  if (!user || !user.is_active) throw new Error('User not found or inactive');

  const session = await SecuritySession.findOne({
    where: {
      session_id: decoded.sid,
      user_id: decoded.user_id,
      revoked_at: null,
      expires_at: { [Op.gt]: new Date() }
    }
  });
  if (!session) throw new Error('Session is invalid or expired');
  return user;
};

const authenticate = async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (String(user.role || '').trim().toLowerCase() !== 'admin') {
      let systemActive;
      try {
        systemActive = await isSystemActive();
      } catch {
        return res.status(503).json({
          success: false,
          code: 'SYSTEM_STATUS_UNAVAILABLE',
          message: 'System availability could not be verified. Please try again later.'
        });
      }
      if (!systemActive) {
        return res.status(503).json({
          success: false,
          code: 'SYSTEM_DEACTIVATED',
          message: 'The campus security system is temporarily deactivated. Please check back later.'
        });
      }
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.message === 'Authentication required') {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (error.message === 'Authentication is not configured correctly') {
      return res.status(500).json({ success: false, message: error.message });
    }
    const message = error.name === 'TokenExpiredError'
      ? 'Token expired. Please log in again.'
      : 'Invalid token';

    return res.status(401).json({ success: false, message });
  }
};

const authenticateOptional = async(req, res, next) => {
  try {
    req.user = await getAuthenticatedUser(req);
  } catch {
    delete req.user;
  }
  return next();
};

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (allowedRoles.length > 0 && !isAllowedRole(req.user.role, allowedRoles)) {
    return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
  }

  return next();
};

module.exports = { authenticate, authenticateOptional, authorize };
