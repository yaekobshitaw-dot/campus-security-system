const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = require('./src/app');
const { sequelize } = require('./src/models');
const { initSocket } = require('./src/config/socket');
const { corsOrigin } = require('./src/config/cors');
const { verifyEmailTransporter } = require('./src/services/emailService');

const PORT = Number(process.env.PORT) || 5002;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connected');
    const emailReady = await verifyEmailTransporter().catch((error) => {
      console.warn('Password reset email transporter verification failed:', error.message);
      return false;
    });
    if (emailReady) console.log('✅ Password reset email transporter verified');

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: { origin: corsOrigin, methods: ['GET', 'POST'] }
    });
    app.set('io', io);
    initSocket(io);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
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
