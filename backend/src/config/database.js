const path = require('path');
const dotenv = require('dotenv');
const { Sequelize } = require('sequelize');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const sequelize = new Sequelize(
  process.env.DB_NAME || 'campus_security',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false
  }
);

module.exports = sequelize;
