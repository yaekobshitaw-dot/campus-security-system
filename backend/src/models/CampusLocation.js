const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const CampusLocation = sequelize.define('CampusLocation', {
  location_id: { type: DataTypes.UUID, defaultValue: uuidv4, primaryKey: true },
  name: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  type: {
    type: DataTypes.ENUM('university', 'administration', 'classroom', 'seminar', 'building/block', 'gate', 'security_post', 'dormitory', 'library', 'clinic', 'cafeteria', 'parking', 'sports', 'emergency_point', 'other'),
    allowNull: false,
    defaultValue: 'other'
  },
  description: { type: DataTypes.TEXT, allowNull: true },
  latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitude: { type: DataTypes.DECIMAL(11, 7), allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
  tableName: 'campus_locations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = CampusLocation;