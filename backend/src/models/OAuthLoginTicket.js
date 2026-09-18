const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const OAuthLoginTicket = sequelize.define('OAuthLoginTicket', {
  ticket_id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true
  },
  ticket_hash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  consumed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'oauth_login_tickets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['ticket_hash', 'expires_at', 'consumed_at'] }]
});

module.exports = OAuthLoginTicket;