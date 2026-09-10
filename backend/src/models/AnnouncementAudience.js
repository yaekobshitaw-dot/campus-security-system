const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const AnnouncementAudience = sequelize.define('AnnouncementAudience', {
  announcement_audience_id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true
  },
  announcement_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('student', 'faculty', 'staff', 'security', 'admin'),
    allowNull: false
  }
}, {
  tableName: 'announcement_audiences',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['announcement_id', 'role']
    }
  ]
});

module.exports = AnnouncementAudience;
