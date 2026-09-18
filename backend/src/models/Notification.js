const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Notification extends Model {}

Notification.init({
  notification_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  type: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'system' },
  title: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'Campus security update' },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  resource_type: { type: DataTypes.STRING(80), allowNull: true },
  resource_id: { type: DataTypes.STRING(255), allowNull: true },
  link: { type: DataTypes.STRING(500), allowNull: true },
  dedupe_key: { type: DataTypes.STRING(255), allowNull: true, unique: true },
  data: { type: DataTypes.JSON, allowNull: true },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  sequelize,
  modelName: 'Notification',
  tableName: 'notifications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['user_id', 'created_at'] }, { unique: true, fields: ['dedupe_key'] }]
});

module.exports = Notification;
