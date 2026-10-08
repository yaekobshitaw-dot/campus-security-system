const nodemailer = require('nodemailer');

const hasUsableValue = (value) =>
  Boolean(value) &&
  !String(value).startsWith('change_me_') &&
  !String(value).startsWith('YOUR_');

const getSmtpConfig = () => {
  const host = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || user).trim();

  return {
    host,
    port,
    user,
    pass,
    from,
    configured: Boolean(
      hasUsableValue(host) &&
      hasUsableValue(user) &&
      hasUsableValue(pass) &&
      hasUsableValue(from)
    )
  };
};

const getEmailServiceStatus = () => {
  const config = getSmtpConfig();

  return {
    configured: config.configured,
    provider: 'gmail-smtp',
    apiKeyConfigured: false,
    senderConfigured: Boolean(hasUsableValue(config.from)),
    frontendUrlConfigured: Boolean(
      hasUsableValue(process.env.FRONTEND_URL)
    )
  };
};

const createTransporter = () => {
  const config = getSmtpConfig();

  if (!config.configured) {
    throw new Error(
      'Gmail SMTP email service is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.'
    );
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000
  });
};

const verifyEmailTransporter = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();

    console.log('✅ Gmail SMTP transporter verified');
    return true;
  } catch (error) {
    console.error(
      '❌ Gmail SMTP verification failed:',
      error.code || 'unknown',
      error.message || 'Unknown SMTP error'
    );
    return false;
  }
};

const getEmailTransportDiagnostic = async () => {
  const config = getSmtpConfig();

  if (!config.configured) {
    return {
      ...getEmailServiceStatus(),
      hostReachable: false,
      authentication: 'not_checked',
      tlsConnection: 'not_checked',
      errorCode: 'NOT_CONFIGURED',
      errorMessage: 'SMTP configuration is incomplete'
    };
  }

  try {
    const transporter = createTransporter();
    await transporter.verify();

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
      tlsConnection: 'failed',
      errorCode: error.code || null,
      errorMessage: String(
        error.message || 'SMTP connection failed'
      ).slice(0, 240)
    };
  }
};

const formatEmailError = (error) => {
  return String(
    error?.response?.body ||
    error?.response?.data?.message ||
    error?.message ||
    'Email delivery failed'
  )
    .replace(/\s+/g, ' ')
    .slice(0, 240);
};

const sendEmail = async (to, subject, html) => {
  const config = getSmtpConfig();

  if (!config.configured) {
    throw new Error(
      'Gmail SMTP email service is not configured'
    );
  }

  const transporter = createTransporter();

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html
    });

    console.log(
      'Email sent through Gmail SMTP:',
      info.messageId || 'unknown'
    );

    return info;
  } catch (error) {
    console.error(
      'Email delivery failed:',
      error.code || 'unknown',
      formatEmailError(error)
    );

    throw error;
  } finally {
    transporter.close();
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
  getEmailServiceConfig: getSmtpConfig,
  getEmailServiceStatus,
  getEmailTransportDiagnostic,
  formatEmailError,

  get emailServiceConfigured() {
    return getSmtpConfig().configured;
  }
};
