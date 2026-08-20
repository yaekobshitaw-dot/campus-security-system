const jwt = require('jsonwebtoken');
const { User } = require('../models');

function initSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || !process.env.JWT_SECRET) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.user_id);
      if (!user || !user.is_active) return next(new Error('Authentication required'));
      socket.user = user;
      return next();
    } catch (error) {
      return next(new Error('Invalid socket token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`role:${socket.user.role}`);
    socket.on('disconnect', () => {
      // Client disconnected
    });
  });
}

module.exports = { initSocket };
