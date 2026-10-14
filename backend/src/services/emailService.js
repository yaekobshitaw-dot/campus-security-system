const axios = require('axios');

const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL =
  'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const SAFE_GOOGLE_ERROR_CODES = new Set([
  'access_denied',
  'invalid_client',
  'invalid_grant',
  'invalid_scope',
  'unauthorized_client',
  'UNAUTHENTICATED',
  'PERMISSION_DENIED'
]);
const NETWORK_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ETIMEDOUT'
]);

const hasUsableValue = (value) =>
  Boolean(value) &&
  !String(value).startsWith('change_me_') &&
  !String(value).startsWith('YOUR_');

const getGmailConfig = () => {
  const clientId = String(process.env.GMAIL_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GMAIL_CLIENT_SECRET || '').trim();
  const refreshToken = String(process.env.GMAIL_REFRESH_TOKEN || '').trim();
  const sender = String(
    process.env.GMAIL_SENDER || ''
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

const getSafeErrorCode = (error) => {
  const providerError = error?.response?.data?.error;
  const candidate = typeof providerError === 'string' ?
    providerError : providerError?.status;

  if (SAFE_GOOGLE_ERROR_CODES.has(candidate)) return candidate;
  if (error?.code === 'NOT_CONFIGURED') return error.code;
  if (SAFE_GOOGLE_ERROR_CODES.has(error?.code)) return error.code;
  if (/^HTTP_[1-5]\d\d$/.test(error?.code || '')) return error.code;
  if (NETWORK_ERROR_CODES.has(error?.code)) return error.code;
  if (Number.isInteger(error?.response?.status)) {
    return `HTTP_${error.response.status}`;
  }
  return 'GMAIL_REQUEST_FAILED';
};

const formatEmailError = (error) => {
  const code = getSafeErrorCode(error);
  const messages = {
    NOT_CONFIGURED: 'Gmail API email service is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_SENDER.',
    invalid_grant: 'Google rejected GMAIL_REFRESH_TOKEN. It may be revoked, expired, or issued for a different OAuth client; reauthorize the Gmail account.',
    invalid_client: 'Google rejected the Gmail OAuth client. Check GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.',
    invalid_scope: 'Google rejected the Gmail OAuth scope. Reauthorize with https://www.googleapis.com/auth/gmail.send.',
    unauthorized_client: 'The configured Google OAuth client is not authorized for this Gmail flow.',
    access_denied: 'Google denied Gmail authorization. Reauthorize the account and grant Gmail send access.',
    ECONNABORTED: 'The Gmail request timed out.',
    ECONNRESET: 'The Gmail connection was interrupted.',
    EAI_AGAIN: 'Google DNS lookup temporarily failed.',
    ENOTFOUND: 'Google could not be reached because DNS lookup failed.',
    ETIMEDOUT: 'The Gmail request timed out.',
    HTTP_401: 'Gmail rejected the access token. Verify the refresh token and OAuth client configuration.',
    HTTP_403: 'Gmail denied the send request. Verify the granted Gmail scope and account permissions.'
  };

  return messages[code] || `Gmail request failed (${code}).`;
};

const createSafeEmailError = (error) => {
  const safeError = new Error(formatEmailError(error));
  safeError.code = getSafeErrorCode(error);
  safeError.isSafeEmailError = true;
  return safeError;
};

const createConfigurationError = () => {
  const error = new Error(formatEmailError({ code: 'NOT_CONFIGURED' }));
  error.code = 'NOT_CONFIGURED';
  error.isSafeEmailError = true;
  return error;
};

const getAccessToken = async () => {
  const config = getGmailConfig();

  if (!config.configured) {
    throw createConfigurationError();
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
    throw createSafeEmailError(error);
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

const sendEmail = async (to, subject, html) => {
  const config = getGmailConfig();

  if (!config.configured) {
    throw createConfigurationError();
  }

  const raw = createRawEmail({
    from: config.sender,
    to,
    subject,
    html
  });

  try {
    let accessToken = await getAccessToken();
    let response;
    try {
      response = await axios.post(
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
    } catch (error) {
      if (error?.response?.status !== 401) throw error;
      accessToken = await getAccessToken();
      response = await axios.post(
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
    }

    console.log(
      'Email sent through Gmail API:',
      response.data?.id || 'unknown'
    );

    return response.data;
  } catch (error) {
    console.error(
      'Gmail API email delivery failed:',
      getSafeErrorCode(error),
      formatEmailError(error)
    );

    throw error?.isSafeEmailError ? error : createSafeEmailError(error);
  }
};

const sendGmailSelfTest = async () => {
  const config = getGmailConfig();
  if (!config.configured) {
    throw createConfigurationError();
  }

  return sendEmail(
    config.sender,
    'Campus Security Gmail integration test',
    '<p>Gmail authentication and message delivery are working.</p>'
  );
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
      hostReachable: !NETWORK_ERROR_CODES.has(error?.code),
      authentication: 'failed',
      tlsConnection: NETWORK_ERROR_CODES.has(error?.code) ? 'unknown' : 'verified',
      providerReachable: !NETWORK_ERROR_CODES.has(error?.code),
      errorCode: getSafeErrorCode(error),
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
  sendGmailSelfTest,
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
