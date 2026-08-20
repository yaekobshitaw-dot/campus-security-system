const sequelize = require('../config/database');
const User = require('./User');
const Incident = require('./Incident');
const Alert = require('./Alert');
const Response = require('./Response');

User.hasMany(Incident, { foreignKey: 'user_id', as: 'reportedIncidents' });
Incident.belongsTo(User, { foreignKey: 'user_id', as: 'reporter' });
Incident.hasMany(Alert, { foreignKey: 'incident_id', as: 'alerts' });
Alert.belongsTo(Incident, { foreignKey: 'incident_id', as: 'incident' });
Incident.hasMany(Response, { foreignKey: 'incident_id', as: 'responses' });
Response.belongsTo(Incident, { foreignKey: 'incident_id', as: 'incident' });
Response.belongsTo(User, { foreignKey: 'responder_id', as: 'responder' });

module.exports = { sequelize, User, Incident, Alert, Response };
