const axios = require('axios');
const { logger } = require('../utils/logger');

const getMlServiceUrl = () => {
  return String(process.env.ML_SERVICE_URL || '').trim().replace(/\/+$/, '');
};

const getLocalRiskPrediction = (data) => {
  const defaultRisk = 'medium';
  const allowedRiskLevels = ['low', 'medium', 'high', 'critical'];

  if (!data) return { risk_level: defaultRisk };

  const highRiskKeywords = ['fire', 'blood', 'weapon', 'explosion', 'chemical'];
  const text = `${data.type || ''} ${data.description || ''}`.toLowerCase();

  if (highRiskKeywords.some((keyword) => text.includes(keyword))) {
    return { risk_level: 'high' };
  }

  const submittedRisk = String(data.severity || '').trim().toLowerCase();

  if (allowedRiskLevels.includes(submittedRisk)) {
    return { risk_level: submittedRisk };
  }

  return { risk_level: defaultRisk };
};

const predictRiskLevel = async (data) => {
  const mlServiceUrl = getMlServiceUrl();

  if (!mlServiceUrl) {
    return getLocalRiskPrediction(data);
  }

  try {
    const response = await axios.post(
      `${mlServiceUrl}/predict/risk`,
      {
        type: data?.type || 'other',
        description: data?.description || '',
        severity: data?.severity || 'medium',
        location: data?.location_name || data?.location || '',
        building: data?.building || '',
        room: data?.room || ''
      },
      {
        timeout: 3000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const result = response.data || {};
    const riskLevel = String(result.risk_level || '').trim().toLowerCase();
    const allowedRiskLevels = ['low', 'medium', 'high', 'critical'];

    if (!allowedRiskLevels.includes(riskLevel)) {
      throw new Error('ML service returned an invalid risk_level');
    }

    logger.info(`ML risk prediction received: ${riskLevel}`);

    return {
      ...result,
      risk_level: riskLevel
    };
  } catch (error) {
    logger.warn(
      `ML service request failed; using local fallback: ${error.message}`
    );

    return getLocalRiskPrediction(data);
  }
};

module.exports = {
  predictRiskLevel
};
