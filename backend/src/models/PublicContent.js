const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const CONTENT_TYPES = ['faq', 'safety_resource', 'emergency_contact', 'service'];

const PublicContent = sequelize.define('PublicContent', {
  content_id: { type: DataTypes.UUID, defaultValue: uuidv4, primaryKey: true },
  type: { type: DataTypes.ENUM(...CONTENT_TYPES), allowNull: false },
  title: { type: DataTypes.STRING(255), allowNull: false },
  summary: { type: DataTypes.STRING(1000), allowNull: true },
  body: { type: DataTypes.TEXT, allowNull: true },
  contact_name: { type: DataTypes.STRING(255), allowNull: true },
  phone: { type: DataTypes.STRING(32), allowNull: true },
  email: { type: DataTypes.STRING(255), allowNull: true },
  url: { type: DataTypes.STRING(1000), allowNull: true },
  priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  created_by: { type: DataTypes.UUID, allowNull: false },
  updated_by: { type: DataTypes.UUID, allowNull: false }
}, {
  tableName: 'public_content',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['type', 'is_active', 'priority'] }]
});

module.exports = { PublicContent, CONTENT_TYPES };
