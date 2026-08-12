// backend/src/scripts/setupDatabase.js
const { sequelize } = require('../models');
const { logger } = require('../utils/logger');

async function setupDatabase() {
  try {
    // Create database if it doesn't exist
    const query = `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`;
    await sequelize.query(query);
    logger.info(`✅ Database ${process.env.DB_NAME} created or already exists`);

    // Sync all models
    await sequelize.sync({ alter: true });
    logger.info('✅ All tables synced successfully');

    // Create indexes for better performance
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)`,
      `CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(type)`,
      `CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity)`,
      `CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
      `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
      `CREATE INDEX IF NOT EXISTS idx_alerts_incident_id ON alerts(incident_id)`,
      `CREATE INDEX IF NOT EXISTS idx_responses_incident_id ON responses(incident_id)`
    ];

    for (const indexQuery of indexes) {
      try {
        await sequelize.query(indexQuery);
      } catch (error) {
        // Some MySQL versions don't support IF NOT EXISTS for indexes
        logger.warn(`Could not create index: ${error.message}`);
      }
    }

    logger.info('✅ Database setup completed successfully');
  } catch (error) {
    logger.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

module.exports = setupDatabase;