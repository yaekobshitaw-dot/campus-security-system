const path = require('path');
const dotenv = require('dotenv');
const { QueryTypes } = require('sequelize');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { sequelize } = require('../models');

async function migrateProfilePhoto() {
  try {
    const columns = await sequelize.query('SHOW COLUMNS FROM users', { type: QueryTypes.SELECT });
    if (!columns.some((column) => column.Field === 'profile_photo_url')) {
      await sequelize.query('ALTER TABLE users ADD COLUMN profile_photo_url VARCHAR(500) NULL');
      console.log('Added users.profile_photo_url.');
    } else {
      console.log('users.profile_photo_url already exists.');
    }
  } finally {
    await sequelize.close();
  }
}

migrateProfilePhoto().catch((error) => {
  console.error(`Profile photo migration failed: ${error.message}`);
  process.exitCode = 1;
});