const { logger } = require('../utils/logger');
const { getIncidentAnalytics } = require('../services/analyticsService');

exports.getAnalytics = async (req, res) => {
  try {
    const analytics = await getIncidentAnalytics(req.query);
    res.json({ success: true, data: analytics });
  } catch (error) {
    logger.error('Get analytics failed:', error);
    res.status(500).json({ success: false, message: 'Unable to load analytics' });
  }
};
