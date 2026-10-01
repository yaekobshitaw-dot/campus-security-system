const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = require('./src/app');
const { sequelize, CampusLocation, Notification, AuditLog, SystemSetting, PublicContent, IncidentHistoryClear } = require('./src/models');
const { initSocket } = require('./src/config/socket');
const { corsOrigin } = require('./src/config/cors');
const { verifyEmailTransporter, formatEmailError } = require('./src/services/emailService');
const { ensureDefaultSettings } = require('./src/services/settingsService');
const ensureAdminSchema = require('./src/scripts/ensureAdminSchema');
const ensureAuthSchema = require('./src/scripts/ensureAuthSchema');
const ensureIncidentSchema = require('./src/scripts/ensureIncidentSchema');

const PORT = Number(process.env.PORT) || 5002;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connected');
    // Ensure schema drift is corrected for the latest incident/response workflow.
    // The assignment workflow adds the `assignment_status` column on the responses table;
    // without this migration the dashboard requests fail with unknown-column SQL errors.
    await ensureIncidentSchema();
    await CampusLocation.sync({ alter: true });
    await ensureAdminSchema();
    await Notification.sync();
    await IncidentHistoryClear.sync();
    await AuditLog.sync();
    await SystemSetting.sync();
    await PublicContent.sync();
    await ensureDefaultSettings();
    await ensureAuthSchema();
    const emailReady = await verifyEmailTransporter().catch((error) => {
      console.warn('Password reset email transporter verification failed:', formatEmailError(error));
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

    // Warm-up Ollama model once on startup to reduce first-request latency.
    try {
      const { askOllama } = require('./src/services/ollamaService');
      (async () => {
        try {
          console.log('ℹ️ Warming Ollama model (this may take several seconds)...');
          await askOllama('Warm-up prompt', 'Warm-up ping');
          console.log('✅ Ollama warm-up completed');
        } catch (warmErr) {
          console.warn(`⚠️ Ollama warm-up failed (${warmErr && warmErr.kind || 'unknown'}); backend remains available`);
        }
      })();
    } catch (requireErr) {
      console.warn('⚠️ Could not load ollamaService for warm-up; backend remains available');
    }

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

