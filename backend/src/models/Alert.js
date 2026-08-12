const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Alert extends Model {}

Alert.init({
  alert_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  incident_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_resolved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  sequelize,
  modelName: 'Alert',
  tableName: 'alerts'
});

module.exports = Alert;
