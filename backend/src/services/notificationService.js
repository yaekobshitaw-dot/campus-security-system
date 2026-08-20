const { logger } = require('../utils/logger');
const axios = require('axios');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const sendPushNotification = async (users, payload) => {
  const messages = (users || [])
    .map((user) => user.push_token)
    .filter((token) => typeof token === 'string' && token.startsWith('ExponentPushToken['))
    .map((to) => ({ to, sound: 'default', ...payload }));

  if (!messages.length) return { sent: 0, skipped: users?.length || 0 };

  try {
    const response = await axios.post(EXPO_PUSH_URL, messages, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      timeout: 10000
    });
    logger.info('Expo push notification request completed', { sent: messages.length });
    return { sent: messages.length, tickets: response.data?.data || [] };
  } catch (error) {
    logger.warn('Expo push notification delivery failed', { message: error.message });
    return { sent: 0, error: 'Push delivery unavailable' };
  }
};

const sendGeofencedAlerts = async (incident, radiusMeters) => {
  logger.info('sendGeofencedAlerts called', { incidentId: incident?.incident_id, radiusMeters });
  return true;
};

module.exports = { sendPushNotification, sendGeofencedAlerts };
