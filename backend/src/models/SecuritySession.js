const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const SecuritySession = sequelize.define('SecuritySession', {
  session_id: { type: DataTypes.UUID, defaultValue: uuidv4, primaryKey: true },
  user_id: { type: DataTypes.UUID, allowNull: false },
  refresh_token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  device_label: { type: DataTypes.STRING(255), allowNull: true },
  ip_address: { type: DataTypes.STRING(64), allowNull: true },
  user_agent: { type: DataTypes.STRING(512), allowNull: true },
  last_active_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  revoked_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'security_sessions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = SecuritySession;