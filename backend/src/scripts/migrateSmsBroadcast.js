const path = require('path');
const dotenv = require('dotenv');
const { Sequelize } = require('sequelize');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredVariables = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER'];
const missing = requiredVariables.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`SMS broadcast migration refused: missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  dialect: 'mysql',
  logging: false,
});

const run = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('sms_messages');
  if (!columns.broadcast_id) await queryInterface.addColumn('sms_messages', 'broadcast_id', { type: Sequelize.UUID, allowNull: true });
  if (!columns.idempotency_key) await queryInterface.addColumn('sms_messages', 'idempotency_key', { type: Sequelize.STRING(128), allowNull: true });

  const indexes = await queryInterface.showIndex('sms_messages');
  if (!indexes.some((index) => index.fields?.some((field) => field.attribute === 'broadcast_id'))) {
    await queryInterface.addIndex('sms_messages', ['broadcast_id'], { name: 'sms_messages_broadcast_id' });
  }
  if (!indexes.some((index) => index.fields?.some((field) => field.attribute === 'idempotency_key'))) {
    await queryInterface.addIndex('sms_messages', ['idempotency_key'], { name: 'sms_messages_idempotency_key' });
  }
  console.log('SMS broadcast migration completed successfully.');
};

run().catch((error) => {
  console.error(`SMS broadcast migration failed: ${error.message}`);
  process.exitCode = 1;
}).finally(() => sequelize.close());