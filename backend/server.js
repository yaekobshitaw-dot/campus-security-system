const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = require('./src/app');
const { sequelize } = require('./src/models');
const ensureIncidentSchema = require('./src/scripts/ensureIncidentSchema');
const { initSocket } = require('./src/config/socket');
const { corsOrigin } = require('./src/config/cors');

const PORT = Number(process.env.PORT) || 5002;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connected');
    await sequelize.sync();
    await ensureIncidentSchema();
    console.log('✅ Incident schema verified');
    console.log('✅ Database synced');

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: { origin: corsOrigin, methods: ['GET', 'POST'] }
    });
    app.set('io', io);
    initSocket(io);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        process.exit(1);
      }

      console.error('❌ Failed to start:', error.message);
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start:', error.message);
    process.exit(1);
  }
}

startServer();
