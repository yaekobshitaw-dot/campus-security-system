const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Response extends Model {}

Response.init({
  response_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  incident_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  responder_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  response_time_seconds: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'Response',
  tableName: 'responses'
});

module.exports = Response;
