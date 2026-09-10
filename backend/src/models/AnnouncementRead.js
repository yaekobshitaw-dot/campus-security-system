const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const AnnouncementRead = sequelize.define('AnnouncementRead', {
  announcement_read_id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true
  },
  announcement_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'announcement_reads',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['announcement_id', 'user_id']
    }
  ]
});

module.exports = AnnouncementRead;
