const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SystemSetting = sequelize.define('SystemSetting', {
  key: { type: DataTypes.STRING(100), primaryKey: true },
  category: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'general' },
  value: { type: DataTypes.STRING(1000), allowNull: true },
  updated_by: { type: DataTypes.UUID, allowNull: true }
}, {
  tableName: 'system_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = SystemSetting;
