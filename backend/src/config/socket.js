function initSocket(io) {
  io.on('connection', (socket) => {
    socket.on('disconnect', () => {
      // Client disconnected
    });
  });
}

module.exports = { initSocket };
