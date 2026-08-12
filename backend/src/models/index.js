const sequelize = require('../config/database');
const User = require('./User');
const Incident = require('./Incident');

User.hasMany(Incident, { foreignKey: 'user_id', as: 'reportedIncidents' });
Incident.belongsTo(User, { foreignKey: 'user_id', as: 'reporter' });

module.exports = { sequelize, User, Incident };
