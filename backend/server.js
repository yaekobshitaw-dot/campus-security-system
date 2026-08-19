const dotenv = require('dotenv');

dotenv.config();

const app = require('./src/app');
const { sequelize } = require('./src/models');

const PORT = Number(process.env.PORT) || 5002;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connected');
    await sequelize.sync();
    console.log('✅ Database synced');

    const server = app.listen(PORT, () => {
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
