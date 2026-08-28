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
    if (socket.user.role === 'security' && !['responding', 'busy'].includes(socket.user.availability_status)) {
      socket.user.update({ availability_status: 'available' }).then(() => {
        io.to('role:security').to('role:admin').emit('officer-location-updated', {
          user_id: socket.user.user_id,
          name: socket.user.name,
          role: socket.user.role,
          latitude: socket.user.latitude,
          longitude: socket.user.longitude,
          availability_status: 'available',
          location_updated_at: socket.user.location_updated_at
        });
      }).catch(() => { });
    }
    socket.on('disconnect', () => {
      if (socket.user.role === 'security') {
        User.update({ availability_status: 'offline' }, {
          where: { user_id: socket.user.user_id, availability_status: 'available' }
        }).then(() => {
          io.to('role:security').to('role:admin').emit('officer-location-updated', {
            user_id: socket.user.user_id,
            name: socket.user.name,
            role: socket.user.role,
            latitude: socket.user.latitude,
            longitude: socket.user.longitude,
            availability_status: 'offline',
            location_updated_at: socket.user.location_updated_at
          });
        }).catch(() => { });
      }
    });
  });
}

module.exports = { initSocket };
