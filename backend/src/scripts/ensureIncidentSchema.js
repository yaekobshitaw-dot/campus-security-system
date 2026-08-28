const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

const requiredColumns = {
  latitude: 'DECIMAL(10,7) NULL',
  longitude: 'DECIMAL(10,7) NULL',
  is_sos: 'BOOLEAN NOT NULL DEFAULT FALSE',
  photos: 'JSON NULL'
};

async function ensureIncidentSchema() {
  const userColumns = await sequelize.query('SHOW COLUMNS FROM users', { type: QueryTypes.SELECT });
  if (!userColumns.some((column) => column.Field === 'push_token')) {
    await sequelize.query('ALTER TABLE users ADD COLUMN push_token VARCHAR(255) NULL');
  }
  if (!userColumns.some((column) => column.Field === 'reset_token_hash')) {
    await sequelize.query('ALTER TABLE users ADD COLUMN reset_token_hash VARCHAR(64) NULL');
  }
  if (!userColumns.some((column) => column.Field === 'reset_token_expires_at')) {
    await sequelize.query('ALTER TABLE users ADD COLUMN reset_token_expires_at DATETIME NULL');
  }
  if (!userColumns.some((column) => column.Field === 'latitude')) {
    await sequelize.query('ALTER TABLE users ADD COLUMN latitude DECIMAL(10,7) NULL');
  }
  if (!userColumns.some((column) => column.Field === 'longitude')) {
    await sequelize.query('ALTER TABLE users ADD COLUMN longitude DECIMAL(10,7) NULL');
  }
  if (!userColumns.some((column) => column.Field === 'location_updated_at')) {
    await sequelize.query('ALTER TABLE users ADD COLUMN location_updated_at DATETIME NULL');
  }
  if (!userColumns.some((column) => column.Field === 'availability_status')) {
    await sequelize.query("ALTER TABLE users ADD COLUMN availability_status ENUM('available','responding','busy','offline') NOT NULL DEFAULT 'offline'");
  }

  const columns = await sequelize.query('SHOW COLUMNS FROM incidents', { type: QueryTypes.SELECT });
  const existingColumns = new Set(columns.map((column) => column.Field));

  const statusColumn = columns.find((column) => column.Field === 'status');
  if (statusColumn && !statusColumn.Type.includes("'investigating'")) {
    await sequelize.query(
      "ALTER TABLE incidents MODIFY COLUMN status ENUM('reported','investigating','resolved','acknowledged','dispatched','on_scene','closed','cancelled') NOT NULL DEFAULT 'reported'"
    );
  }

  for (const [columnName, definition] of Object.entries(requiredColumns)) {
    if (!existingColumns.has(columnName)) {
      await sequelize.query(`ALTER TABLE incidents ADD COLUMN ${columnName} ${definition}`);
    }
  }

  const responseColumns = await sequelize.query('SHOW COLUMNS FROM responses', { type: QueryTypes.SELECT });
  if (!responseColumns.some((column) => column.Field === 'assigned_by')) {
    await sequelize.query('ALTER TABLE responses ADD COLUMN assigned_by CHAR(36) NULL');
  }
  if (!responseColumns.some((column) => column.Field === 'status')) {
    await sequelize.query("ALTER TABLE responses ADD COLUMN status ENUM('assigned','responding','resolved','closed') NOT NULL DEFAULT 'assigned'");
  }

  const alertColumns = await sequelize.query('SHOW COLUMNS FROM alerts', { type: QueryTypes.SELECT });
  if (!alertColumns.some((column) => column.Field === 'title')) {
    await sequelize.query('ALTER TABLE alerts ADD COLUMN title VARCHAR(255) NULL AFTER type');
  }
  if (!alertColumns.some((column) => column.Field === 'is_read')) {
    await sequelize.query('ALTER TABLE alerts ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT FALSE AFTER is_resolved');
  }
  if (!alertColumns.some((column) => column.Field === 'channel')) {
    await sequelize.query("ALTER TABLE alerts ADD COLUMN channel VARCHAR(50) DEFAULT 'dashboard' AFTER is_read");
  }
  if (!alertColumns.some((column) => column.Field === 'sent_at')) {
    await sequelize.query('ALTER TABLE alerts ADD COLUMN sent_at DATETIME NULL AFTER channel');
  }
}

module.exports = ensureIncidentSchema;
