const { logger } = require('../utils/logger');

const getIncidentAnalytics = async (filters = {}) => {
  logger.info('Computing incident analytics', { filters });
  return {
    total_incidents: 0,
    by_severity: { low: 0, medium: 0, high: 0, critical: 0 },
    by_status: { reported: 0, acknowledged: 0, dispatched: 0, on_scene: 0, resolved: 0, closed: 0, cancelled: 0 },
    trends: []
  };
};

module.exports = { getIncidentAnalytics };
