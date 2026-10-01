const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const CONTENT_TYPES = ['faq', 'safety_resource', 'emergency_contact', 'service'];

const DEFAULT_PUBLIC_CONTENT = [
  { type: 'emergency_contact', title: 'Contact Us Information', summary: 'Tuluawulia', contact_name: 'Contact Us', phone: '0976296127', email: 'yaekobshitaw@gmail.com', priority: 96, is_active: true },
  { type: 'emergency_contact', title: 'Developed by', summary: 'FENTAW SHITAW', contact_name: 'FENTAW SHITAW', priority: 100, is_active: true },
  { type: 'emergency_contact', title: 'Security Phone', phone: '0976296127', summary: '0976296127', contact_name: 'Security Phone', priority: 99, is_active: true },
  { type: 'emergency_contact', title: 'Security Email', email: 'YAEKOBSHITAW@GMAIL.COM', summary: 'YAEKOBSHITAW@GMAIL.COM', contact_name: 'Security Email', priority: 98, is_active: true },
  { type: 'emergency_contact', title: 'Security Office Location', summary: 'TULU AWULIA', contact_name: 'Security Office Location', priority: 97, is_active: true }
];

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

const DEFAULT_PUBLIC_CONTENT_USER_ID = '00000000-0000-0000-0000-000000000001';

const ensureDefaultPublicContent = async () => {
  for (const item of DEFAULT_PUBLIC_CONTENT) {
    await PublicContent.findOrCreate({
      where: { type: item.type, title: item.title },
      defaults: {
        ...item,
        created_by: DEFAULT_PUBLIC_CONTENT_USER_ID,
        updated_by: DEFAULT_PUBLIC_CONTENT_USER_ID,
      }
    });
  }
};

module.exports = { PublicContent, CONTENT_TYPES, DEFAULT_PUBLIC_CONTENT, ensureDefaultPublicContent };
