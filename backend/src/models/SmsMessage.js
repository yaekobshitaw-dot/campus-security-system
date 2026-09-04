const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SmsMessage = sequelize.define('SmsMessage', {
  sms_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  sender_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  recipient_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  recipient_phone: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('queued', 'sent', 'failed', 'delivered', 'expired'),
    allowNull: false,
    defaultValue: 'queued',
  },
  provider: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  provider_message_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  provider_response: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'sms_messages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SmsMessage;
