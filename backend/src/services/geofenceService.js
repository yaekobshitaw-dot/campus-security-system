const { Op } = require('sequelize');
const { User } = require('../models');
const { calculateDistance } = require('../utils/helpers');
const { logger } = require('../utils/logger');

const sendGeofencedAlerts = async (incident, radiusMeters = 500) => {
  if (!incident || !incident.latitude || !incident.longitude) {
    return [];
  }

  const users = await User.findAll({
    where: {
      is_active: true,
      location_lat: { [Op.ne]: null },
      location_lng: { [Op.ne]: null }
    }
  });

  const nearbyUsers = users.filter((user) => {
    const distance = calculateDistance(
      Number(incident.latitude),
      Number(incident.longitude),
      Number(user.location_lat),
      Number(user.location_lng)
    );
    return distance <= radiusMeters;
  });

  logger.info(`Found ${nearbyUsers.length} nearby users for geofenced alerts`);
  return nearbyUsers;
};

module.exports = { sendGeofencedAlerts };
