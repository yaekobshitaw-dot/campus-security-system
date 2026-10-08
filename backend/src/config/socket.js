const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { SecuritySession, User } = require('../models');
const { isSystemActive } = require('../services/settingsService');

function initSocket(io) {
  // Simple in-memory presence map: user_id -> { count, lastSeen }
  // Note: in-memory only; survives process lifetime. Avoids creating a second persistent presence store.
  io.presence = new Map();

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || !process.env.JWT_SECRET) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.user_id || !decoded.sid) return next(new Error('Authentication required'));
      const user = await User.findByPk(decoded.user_id);
      if (!user || !user.is_active) return next(new Error('Authentication required'));
      const session = await SecuritySession.findOne({
        where: {
          session_id: decoded.sid,
          user_id: decoded.user_id,
          revoked_at: null,
          expires_at: { [Op.gt]: new Date() }
        }
      });
      if (!session) return next(new Error('Authentication required'));
      if (String(user.role || '').trim().toLowerCase() !== 'admin' && !(await isSystemActive())) {
        return next(new Error('The campus security system is temporarily deactivated'));
      }
      socket.user = user;
      socket.sessionId = decoded.sid;
      return next();
    } catch (error) {
      return next(new Error('Invalid socket token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`role:${socket.user.role}`);
    socket.join(`user:${socket.user.user_id}`);

    try {
      const presence = io.presence || new Map();
      const userId = socket.user.user_id;
      const entry = presence.get(userId) || { count: 0, lastSeen: null };
      entry.count += 1;
      entry.lastSeen = Date.now();
      presence.set(userId, entry);
      io.presence = presence;

      // Emit an update so dashboards can reflect this user as online/available
      const isPresentNow = presence.has(userId) || (entry && entry.count > 0);
      const payload = {
        user_id: socket.user.user_id,
        name: socket.user.name,
        role: socket.user.role,
        latitude: socket.user.latitude,
        longitude: socket.user.longitude,
        availability_status: socket.user.availability_status,
        location_updated_at: socket.user.location_updated_at,
        presence: Boolean(isPresentNow)
      };
      io.to('role:security').to('role:admin').emit('officer-location-updated', payload);
    } catch (err) {
      // non-fatal
      console.warn('Presence update failed on connect:', err?.message || err);
    }

    socket.on('disconnect', () => {
      try {
        const presence = io.presence || new Map();
        const userId = socket.user.user_id;
        const entry = presence.get(userId);
        if (entry) {
          entry.count = Math.max(0, entry.count - 1);
          if (entry.count === 0) presence.delete(userId);
          else presence.set(userId, entry);
        }
        io.presence = presence;

        const isPresentNow = presence.has(userId) || (entry && entry.count > 0);
        const payload = {
          user_id: socket.user.user_id,
          name: socket.user.name,
          role: socket.user.role,
          latitude: socket.user.latitude,
          longitude: socket.user.longitude,
          availability_status: socket.user.availability_status,
          location_updated_at: socket.user.location_updated_at,
          presence: Boolean(isPresentNow)
        };
        io.to('role:security').to('role:admin').emit('officer-location-updated', payload);
      } catch (err) {
        console.warn('Presence update failed on disconnect:', err?.message || err);
      }
    });
  });
}

const disconnectSessionSockets = (io, sessionId) => {
  const sockets = io?.sockets?.sockets;
  for (const socket of sockets?.values() || []) {
    if (socket.sessionId === sessionId) socket.disconnect(true);
  }
};

module.exports = { disconnectSessionSockets, initSocket };
