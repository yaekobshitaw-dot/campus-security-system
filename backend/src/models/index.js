const sequelize = require('../config/database');
const User = require('./User');
const Incident = require('./Incident');
const Alert = require('./Alert');
const Response = require('./Response');
const SmsMessage = require('./SmsMessage');
const Zone = require('./Zone');
const Announcement = require('./Announcement');
const AnnouncementAudience = require('./AnnouncementAudience');
const AnnouncementRead = require('./AnnouncementRead');
const CampusLocation = require('./CampusLocation');
const Notification = require('./Notification');
const AuditLog = require('./AuditLog');
const SystemSetting = require('./SystemSetting');
const { PublicContent, CONTENT_TYPES } = require('./PublicContent');

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
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(AuditLog, { foreignKey: 'actor_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });
Announcement.hasMany(AnnouncementAudience, { foreignKey: 'announcement_id', as: 'audiences' });
AnnouncementAudience.belongsTo(Announcement, { foreignKey: 'announcement_id', as: 'announcement' });
Announcement.hasMany(AnnouncementRead, { foreignKey: 'announcement_id', as: 'reads' });
AnnouncementRead.belongsTo(Announcement, { foreignKey: 'announcement_id', as: 'announcement' });

module.exports = {
	sequelize,
	User,
	Incident,
	Alert,
	Response,
	SmsMessage,
	Zone,
	Announcement,
	AnnouncementAudience,
	AnnouncementRead,
	CampusLocation,
	Notification,
	AuditLog,
	SystemSetting,
	PublicContent,
	CONTENT_TYPES
};
