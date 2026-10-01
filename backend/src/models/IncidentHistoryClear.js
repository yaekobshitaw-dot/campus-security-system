const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class IncidentHistoryClear extends Model {}

IncidentHistoryClear.init({
  user_id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false
  },
  cleared_at: {
    type: DataTypes.DATE(3),
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'IncidentHistoryClear',
  tableName: 'incident_history_clears',
  timestamps: false
});

module.exports = IncidentHistoryClear;
