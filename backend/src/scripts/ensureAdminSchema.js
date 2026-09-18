const { DataTypes } = require('sequelize');
const { sequelize, SystemSetting, PublicContent } = require('../models');

const hasColumn = (columns, name) => Object.prototype.hasOwnProperty.call(columns, name);
const hasIndex = (indexes, name, fields, unique = false) => indexes.some((index) => index.name === name
  && (!unique || index.unique === true)
  && (!fields || fields.every((field, position) => index.fields?.[position]?.attribute === field)));

const ensureColumn = async (queryInterface, tableName, columns, name, definition) => {
  if (!hasColumn(columns, name)) {
    await queryInterface.addColumn(tableName, name, definition);
    columns[name] = definition;
  }
};

const ensureAdminSchema = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const notifications = await queryInterface.describeTable('notifications');
  await ensureColumn(queryInterface, 'notifications', notifications, 'type', { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'system' });
  await ensureColumn(queryInterface, 'notifications', notifications, 'title', { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'Campus security update' });
  await ensureColumn(queryInterface, 'notifications', notifications, 'resource_type', { type: DataTypes.STRING(80), allowNull: true });
  await ensureColumn(queryInterface, 'notifications', notifications, 'resource_id', { type: DataTypes.STRING(255), allowNull: true });
  await ensureColumn(queryInterface, 'notifications', notifications, 'link', { type: DataTypes.STRING(500), allowNull: true });
  await ensureColumn(queryInterface, 'notifications', notifications, 'dedupe_key', { type: DataTypes.STRING(255), allowNull: true });
  await ensureColumn(queryInterface, 'notifications', notifications, 'data', { type: DataTypes.JSON, allowNull: true });

  const notificationIndexes = await queryInterface.showIndex('notifications');
  if (!hasIndex(notificationIndexes, 'notifications_dedupe_key_unique', ['dedupe_key'], true)) {
    await queryInterface.addIndex('notifications', ['dedupe_key'], { name: 'notifications_dedupe_key_unique', unique: true });
  }
  if (!hasIndex(notificationIndexes, 'notifications_user_id_created_at', ['user_id', 'created_at'])) {
    await queryInterface.addIndex('notifications', ['user_id', 'created_at'], { name: 'notifications_user_id_created_at' });
  }

  const announcements = await queryInterface.describeTable('announcements');
  await ensureColumn(queryInterface, 'announcements', announcements, 'is_public', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });

  await SystemSetting.sync();
  await PublicContent.sync();
  return { notifications: Object.keys(notifications), announcements: Object.keys(announcements) };
};

if (require.main === module) {
  ensureAdminSchema()
    .then(() => console.log('Admin schema migration completed safely.'))
    .catch((error) => {
      console.error(`Admin schema migration failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = ensureAdminSchema;
