const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const MfaRecoveryCode = sequelize.define('MfaRecoveryCode', {
  recovery_code_id: { type: DataTypes.UUID, defaultValue: uuidv4, primaryKey: true },
  user_id: { type: DataTypes.UUID, allowNull: false },
  code_hash: { type: DataTypes.STRING(64), allowNull: false },
  consumed_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'mfa_recovery_codes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['user_id', 'code_hash'] }]
});

module.exports = MfaRecoveryCode;