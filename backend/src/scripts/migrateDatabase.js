const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredVariables = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER'];
const expectedTarget = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '3307',
  DB_NAME: 'campus_security'
};

const fail = (message) => {
  console.error(`Database migration refused: ${message}`);
  process.exitCode = 1;
};

const validateMigrationEnvironment = () => {
  const missing = requiredVariables.filter((name) => !process.env[name]);
  if (missing.length) {
    fail(`missing required environment variables: ${missing.join(', ')}`);
    return false;
  }

  if (process.env.DB_MIGRATION_CONFIRM !== 'true') {
    fail('DB_MIGRATION_CONFIRM=true is required');
    return false;
  }

  for (const [name, expected] of Object.entries(expectedTarget)) {
    if (process.env[name] !== expected) {
      fail(`${name} must be ${expected} for this migration target`);
      return false;
    }
  }

  return true;
};

async function runMigration() {
  if (!validateMigrationEnvironment()) return;

  const { sequelize } = require('../models');
  const setupDatabase = require('./setupDatabase');

  try {
    await setupDatabase();
    console.log('Database migration completed successfully.');
  } catch (error) {
    console.error('Database migration failed.');
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

runMigration();
