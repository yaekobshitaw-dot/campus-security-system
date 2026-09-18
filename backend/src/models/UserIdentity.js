const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const UserIdentity = sequelize.define('UserIdentity', {
  identity_id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  provider: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  provider_subject: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  provider_email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'user_identities',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['provider', 'provider_subject'] },
    { unique: true, fields: ['user_id', 'provider'] }
  ]
});

module.exports = UserIdentity;