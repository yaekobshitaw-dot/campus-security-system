const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Analytics extends Model {}

Analytics.init({
  analytics_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  metric: {
    type: DataTypes.STRING,
    allowNull: false
  },
  value: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  }
}, {
  sequelize,
  modelName: 'Analytics',
  tableName: 'analytics'
});

module.exports = Analytics;
