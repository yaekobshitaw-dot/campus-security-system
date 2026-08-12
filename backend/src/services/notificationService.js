const { logger } = require('../utils/logger');

const sendPushNotification = async (users, payload) => {
  logger.info('sendPushNotification called', { recipients: users.length || 0, payload });
  return true;
};

const sendGeofencedAlerts = async (incident, radiusMeters) => {
  logger.info('sendGeofencedAlerts called', { incidentId: incident?.incident_id, radiusMeters });
  return true;
};

module.exports = { sendPushNotification, sendGeofencedAlerts };
