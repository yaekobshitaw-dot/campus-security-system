const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const AuditLog = sequelize.define('AuditLog', {
  audit_id: { type: DataTypes.UUID, defaultValue: uuidv4, primaryKey: true },
  actor_id: { type: DataTypes.UUID, allowNull: true },
  action: { type: DataTypes.STRING(100), allowNull: false },
  resource_type: { type: DataTypes.STRING(100), allowNull: false },
  resource_id: { type: DataTypes.STRING(255), allowNull: true },
  details: { type: DataTypes.TEXT, allowNull: true },
  ip_address: { type: DataTypes.STRING(64), allowNull: true }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = AuditLog;
