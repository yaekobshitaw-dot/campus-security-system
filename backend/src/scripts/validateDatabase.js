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
  console.error(`Database validation failed: ${message}`);
  process.exitCode = 1;
};

const validateEnvironment = () => {
  const missing = requiredVariables.filter((name) => !process.env[name]);
  if (missing.length) {
    fail(`missing required environment variables: ${missing.join(', ')}`);
    return false;
  }

  for (const [name, expected] of Object.entries(expectedTarget)) {
    if (process.env[name] !== expected) {
      fail(`${name} must be ${expected} for read-only validation`);
      return false;
    }
  }

  return true;
};

async function validateDatabase() {
  if (!validateEnvironment()) return;

  const sequelize = require('../config/database');
  const tables = ['users', 'incidents', 'alerts', 'responses', 'zones'];

  try {
    await sequelize.authenticate();
    console.log('AUTHENTICATE: SUCCESS');

    const [version] = await sequelize.query('SELECT VERSION() AS version');
    const [database] = await sequelize.query('SELECT DATABASE() AS database_name');
    console.log(`MARIADB_VERSION: ${version[0].version}`);
    console.log(`DATABASE: ${database[0].database_name}`);

    for (const table of tables) {
      const [rows] = await sequelize.query(`SELECT COUNT(*) AS count FROM ${table}`);
      console.log(`${table.toUpperCase()}: ${rows[0].count}`);
    }
  } catch (error) {
    fail('connection or read-only query error');
  } finally {
    await sequelize.close();
  }
}

validateDatabase();
