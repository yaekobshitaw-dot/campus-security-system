// backend/src/models/Zone.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { validateZonePayload } = require('../validators/zoneValidator');

const Zone = sequelize.define('Zone', {
  zone_id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  coordinates: {
    type: DataTypes.JSON,
    allowNull: true
  },
  center_lat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true
  },
  center_lng: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true
  },
  radius: {
    type: DataTypes.INTEGER,
    defaultValue: 500
  },
  security_contact: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'zones',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  validate: {
    geometryContract() {
      validateZonePayload(this.toJSON());
    }
  }
});

// Static methods
Zone.findNearestZone = async function(lat, lng) {
  // MySQL query to find nearest zone using distance calculation
  const zones = await this.findAll({
    where: { is_active: true },
    attributes: [
      'zone_id',
      'name',
      'description',
      'center_lat',
      'center_lng',
      'radius',
      [
        sequelize.literal(`
          (6371 * acos(
            cos(radians(${lat})) * cos(radians(center_lat)) *
            cos(radians(center_lng) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(center_lat))
          ))
        `),
        'distance'
      ]
    ],
    order: [[sequelize.literal('distance'), 'ASC']],
    limit: 1
  });

  return zones[0] || null;
};

module.exports = Zone;