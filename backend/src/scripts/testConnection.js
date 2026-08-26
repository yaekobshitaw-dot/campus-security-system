// backend/src/scripts/testConnection.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { sequelize } = require('../models');
const { logger } = require('../utils/logger');

async function testConnection() {
  try {
    await sequelize.authenticate();
    logger.info('✅ MySQL connection established successfully.');

    // Test query
    const [results] = await sequelize.query('SELECT VERSION() as version');
    logger.info(`📊 MySQL Version: ${results[0].version}`);

    // Test database selection
    const [db] = await sequelize.query('SELECT DATABASE() as db_name');
    logger.info(`🗄️ Database: ${db[0].db_name}`);

    process.exit(0);
  } catch (error) {
    logger.error('❌ Unable to connect to MySQL:', error);
    process.exit(1);
  }
}

testConnection();