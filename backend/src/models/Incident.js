// src/models/Incident.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Incident = sequelize.define('Incident', {
  incident_id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('fire', 'medical', 'security_threat', 'suspicious_package', 'flood', 'power_outage', 'missing_person', 'natural_disaster', 'assault', 'theft', 'vandalism', 'other'),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium'
  },
  status: {
    type: DataTypes.ENUM('reported', 'investigating', 'resolved', 'acknowledged', 'dispatched', 'on_scene', 'closed', 'cancelled'),
    defaultValue: 'reported'
  },
  location_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  building: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  room: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  is_anonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'incidents',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Incident;
