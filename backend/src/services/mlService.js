const { logger } = require('../utils/logger');

const predictRiskLevel = async (data) => {
  const defaultRisk = 'medium';
  if (!data) return { risk_level: defaultRisk };

  const highRiskKeywords = ['fire', 'blood', 'weapon', 'explosion', 'chemical'];
  const text = `${data.type || ''} ${data.description || ''}`.toLowerCase();

  if (highRiskKeywords.some((keyword) => text.includes(keyword))) {
    return { risk_level: 'high' };
  }

  if (data.severity) {
    return { risk_level: data.severity };
  }

  logger.info('Defaulting ML risk prediction to medium');
  return { risk_level: defaultRisk };
};

module.exports = { predictRiskLevel };
