const axios = require('axios');

const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL =
  'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

const hasUsableValue = (value) =>
  Boolean(value) &&
  !String(value).startsWith('change_me_') &&
  !String(value).startsWith('YOUR_');

const getGmailConfig = () => {
  const clientId = String(process.env.GMAIL_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GMAIL_CLIENT_SECRET || '').trim();
  const refreshToken = String(process.env.GMAIL_REFRESH_TOKEN || '').trim();
  const sender = String(
    process.env.GMAIL_SENDER || 'yaekobshitaw@gmail.com'
  ).trim();

  return {
    clientId,
    clientSecret,
    refreshToken,
    sender,
    configured: Boolean(
      hasUsableValue(clientId) &&
      hasUsableValue(clientSecret) &&
      hasUsableValue(refreshToken) &&
      hasUsableValue(sender)
    )
  };
};

const getEmailServiceStatus = () => {
  const config = getGmailConfig();

  return {
    configured: config.configured,
    provider: 'gmail-api',
    apiKeyConfigured: false,
    senderConfigured: Boolean(hasUsableValue(config.sender)),
    frontendUrlConfigured: Boolean(
      hasUsableValue(process.env.FRONTEND_URL)
    )
  };
};

const getAccessToken = async () => {
  const config = getGmailConfig();

  if (!config.configured) {
    throw new Error(
      'Gmail API email service is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN and GMAIL_SENDER.'
    );
  }

  try {
    const response = await axios.post(
      GMAIL_TOKEN_URL,
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token'
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }
    );

    if (!response.data?.access_token) {
      throw new Error(
        'Google OAuth response did not contain an access token'
      );
    }

    return response.data.access_token;
  } catch (error) {
    const message =
      error?.response?.data?.error_description ||
      error?.response?.data?.error ||
      error?.message ||
      'Unable to obtain Gmail access token';

    throw new Error(
      `Gmail OAuth token request failed: ${message}`
    );
  }
};

const base64UrlEncode = (value) => {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const createRawEmail = ({ from, to, subject, html }) => {
  const normalizedHtml = String(html || '').replace(
    /\r?\n/g,
    '\r\n'
  );

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    normalizedHtml
  ].join('\r\n');

  return base64UrlEncode(message);
};

const formatEmailError = (error) => {
  return String(
    error?.response?.data?.error?.message ||
    error?.response?.data?.error_description ||
    error?.response?.data?.message ||
    error?.message ||
    'Email delivery failed'
  )
    .replace(/\s+/g, ' ')
    .slice(0, 240);
};

const sendEmail = async (to, subject, html) => {
  const config = getGmailConfig();

  if (!config.configured) {
    throw new Error(
      'Gmail API email service is not configured'
    );
  }

  const accessToken = await getAccessToken();

  const raw = createRawEmail({
    from: config.sender,
    to,
    subject,
    html
  });

  try {
    const response = await axios.post(
      GMAIL_SEND_URL,
      { raw },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log(
      'Email sent through Gmail API:',
      response.data?.id || 'unknown'
    );

    return response.data;
  } catch (error) {
    console.error(
      'Gmail API email delivery failed:',
      error?.response?.status || 'unknown',
      formatEmailError(error)
    );

    throw error;
  }
};

const verifyEmailTransporter = async () => {
  try {
    await getAccessToken();

    console.log('Gmail API authorization verified');
    return true;
  } catch (error) {
    console.error(
      'Gmail API verification failed:',
      formatEmailError(error)
    );
    return false;
  }
};

const getEmailTransportDiagnostic = async () => {
  const config = getGmailConfig();

  if (!config.configured) {
    return {
      ...getEmailServiceStatus(),
      hostReachable: false,
      authentication: 'not_checked',
      tlsConnection: 'not_checked',
      errorCode: 'NOT_CONFIGURED',
      errorMessage: 'Gmail API configuration is incomplete'
    };
  }

  try {
    await getAccessToken();

    return {
      ...getEmailServiceStatus(),
      hostReachable: true,
      authentication: 'verified',
      tlsConnection: 'verified',
      errorCode: null,
      errorMessage: null
    };
  } catch (error) {
    return {
      ...getEmailServiceStatus(),
      hostReachable: false,
      authentication: 'failed',
      tlsConnection: 'verified',
      errorCode:
        error?.response?.data?.error ||
        error?.code ||
        null,
      errorMessage: formatEmailError(error)
    };
  }
};

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
  getEmailServiceConfig: getGmailConfig,
  getEmailServiceStatus,
  getEmailTransportDiagnostic,
  formatEmailError,

  get emailServiceConfigured() {
    return getGmailConfig().configured;
  }
};
