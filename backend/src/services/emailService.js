// src/services/emailService.js
const axios = require('axios');

const hasUsableValue = (value) =>
  Boolean(value) &&
  !String(value).startsWith('change_me_') &&
  !String(value).startsWith('YOUR_');

const getResendConfig = () => {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(
    process.env.RESEND_FROM || 'onboarding@resend.dev'
  ).trim();

  return {
    apiKey,
    from,
    configured: Boolean(
      hasUsableValue(apiKey) &&
      hasUsableValue(from)
    )
  };
};

const getEmailServiceStatus = () => {
  const config = getResendConfig();

  return {
    configured: config.configured,
    provider: 'resend',
    apiKeyConfigured: Boolean(hasUsableValue(config.apiKey)),
    senderConfigured: Boolean(hasUsableValue(config.from)),
    frontendUrlConfigured: Boolean(
      hasUsableValue(process.env.FRONTEND_URL)
    )
  };
};

const verifyEmailTransporter = async () => {
  const config = getResendConfig();

  if (!config.configured) {
    console.warn(
      'Password reset email service is not configured. Set RESEND_API_KEY and RESEND_FROM.'
    );
    return false;
  }

  return true;
};

const getEmailTransportDiagnostic = async () => {
  const config = getResendConfig();

  return {
    ...getEmailServiceStatus(),
    hostReachable: config.configured,
    authentication: config.configured ? 'not_tested' : 'not_checked',
    tlsConnection: 'not_applicable',
    errorCode: null,
    errorMessage: null
  };
};

const formatEmailError = (error) => {
  const message =
    error?.response?.data?.message ||
    error?.message ||
    'Email delivery failed';

  return String(message)
    .replace(/\s+/g, ' ')
    .slice(0, 240);
};

const sendEmail = async (to, subject, html) => {
  const config = getResendConfig();

  try {
    if (!config.configured) {
      throw new Error(
        'Password reset email service is not configured'
      );
    }

    const response = await axios.post(
      'https://api.resend.com/emails',
      {
        from: config.from,
        to: [to],
        subject,
        html
      },
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log(
      'Email sent through Resend:',
      response.data?.id || 'unknown'
    );

    return response.data;
  } catch (error) {
    console.error(
      'Email delivery failed:',
      error.response?.status || error.code || 'unknown',
      formatEmailError(error)
    );

    throw error;
  }
};

// Send incident alert email
const sendIncidentAlert = async (incident, userEmail) => {
  const html =
    '<h1>Incident Alert</h1>' +
    '<p><strong>Type:</strong> ' + incident.type + '</p>' +
    '<p><strong>Severity:</strong> ' + incident.severity + '</p>' +
    '<p><strong>Description:</strong> ' +
    (incident.description || 'No description') + '</p>' +
    '<p><strong>Location:</strong> ' +
    (incident.location_name || 'Unknown') + '</p>' +
    '<p><strong>Status:</strong> ' + incident.status + '</p>' +
    '<p><strong>Time:</strong> ' +
    new Date(incident.created_at).toLocaleString() + '</p>' +
    '<hr>' +
    '<p><small>Sent from Campus Security System</small></p>';

  return await sendEmail(
    userEmail,
    'Incident Alert: ' + incident.type.toUpperCase(),
    html
  );
};

module.exports = {
  sendEmail,
  sendIncidentAlert,
  verifyEmailTransporter,
  getEmailServiceConfig: getResendConfig,
  getEmailServiceStatus,
  getEmailTransportDiagnostic,
  formatEmailError,

  get emailServiceConfigured() {
    return getResendConfig().configured;
  }
};
