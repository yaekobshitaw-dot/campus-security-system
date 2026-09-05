const sequelize = require('../config/database');
const User = require('./User');
const Incident = require('./Incident');
const Alert = require('./Alert');
const Response = require('./Response');
const SmsMessage = require('./SmsMessage');
const Zone = require('./Zone');

User.hasMany(Incident, { foreignKey: 'user_id', as: 'reportedIncidents' });
Incident.belongsTo(User, { foreignKey: 'user_id', as: 'reporter' });
Incident.hasMany(Alert, { foreignKey: 'incident_id', as: 'alerts' });
Alert.belongsTo(Incident, { foreignKey: 'incident_id', as: 'incident' });
Incident.hasMany(Response, { foreignKey: 'incident_id', as: 'responses' });
Response.belongsTo(Incident, { foreignKey: 'incident_id', as: 'incident' });
Response.belongsTo(User, { foreignKey: 'responder_id', as: 'responder' });
User.hasMany(SmsMessage, { foreignKey: 'recipient_user_id', as: 'receivedSmsMessages' });
User.hasMany(SmsMessage, { foreignKey: 'sender_user_id', as: 'sentSmsMessages' });
SmsMessage.belongsTo(User, { foreignKey: 'recipient_user_id', as: 'recipient' });
SmsMessage.belongsTo(User, { foreignKey: 'sender_user_id', as: 'sender' });

module.exports = { sequelize, User, Incident, Alert, Response, SmsMessage, Zone };
