// src/services/emailService.js
const nodemailer = require('nodemailer');

const hasUsableValue = (value) => value && !value.startsWith('change_me_') && !value.startsWith('YOUR_');
const redactErrorMessage = (message, config) => String(message || 'SMTP verification failed')
  .replace(config.pass, '[redacted]')
  .replace(config.user, '[redacted]')
  .replace(/\s+/g, ' ')
  .slice(0, 240);
const getEmailServiceConfig = () => {
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || user).trim();
  return {
    host: String(process.env.SMTP_HOST || '').trim(),
    port,
    user,
    pass,
    from,
    secure: port === 465,
    configured: Boolean(hasUsableValue(process.env.SMTP_HOST) && hasUsableValue(user) && hasUsableValue(pass) && hasUsableValue(from))
  };
};

const createTransporter = (config) => nodemailer.createTransport({
  host: config.host,
  port: config.port,
  secure: config.secure,
  auth: { user: config.user, pass: config.pass },
  tls: { rejectUnauthorized: true }
});

const getEmailServiceStatus = (config = getEmailServiceConfig()) => ({
  configured: config.configured,
  hostConfigured: Boolean(hasUsableValue(config.host)),
  port: config.port,
  userConfigured: Boolean(hasUsableValue(config.user)),
  passwordConfigured: Boolean(hasUsableValue(config.pass)),
  senderConfigured: Boolean(hasUsableValue(config.from)),
  frontendUrlConfigured: Boolean(hasUsableValue(process.env.FRONTEND_URL)),
  tlsConfigured: true,
  secureTransport: config.secure
});

const verifyEmailTransporter = async () => {
  const config = getEmailServiceConfig();
  if (!config.configured) {
    console.warn('Password reset email service is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, and FRONTEND_URL to enable it.');
    return false;
  }

  await createTransporter(config).verify();
  return true;
};

const getEmailTransportDiagnostic = async () => {
  const config = getEmailServiceConfig();
  const diagnostic = {
    ...getEmailServiceStatus(config),
    hostReachable: false,
    authentication: 'not_checked',
    tlsConnection: 'not_checked',
    errorCode: null,
    errorMessage: null
  };

  if (!config.configured) return diagnostic;

  try {
    await createTransporter(config).verify();
    diagnostic.hostReachable = true;
    diagnostic.authentication = 'successful';
    diagnostic.tlsConnection = 'successful';
  } catch (error) {
    diagnostic.hostReachable = !['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH'].includes(error.code);
    diagnostic.authentication = error.code === 'EAUTH' || error.responseCode === 535 ? 'failed' : 'not_confirmed';
    diagnostic.tlsConnection = ['ESOCKET', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT'].includes(error.code) ? 'failed' : 'not_confirmed';
    diagnostic.errorCode = error.code || null;
    diagnostic.errorMessage = redactErrorMessage(error.message, config);
  }

  return diagnostic;
};

const formatEmailError = (error) => redactErrorMessage(error?.message, getEmailServiceConfig());

// Send email function
const sendEmail = async (to, subject, html) => {
  try {
    if (!(await verifyEmailTransporter())) {
      throw new Error('Password reset email service is not configured');
    }

    const mailOptions = {
      from: getEmailServiceConfig().from,
      to: to,
      subject: subject,
      html: html
    };
    const info = await createTransporter(getEmailServiceConfig()).sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email delivery failed:', error.code || 'unknown', formatEmailError(error));
    throw error;
  }
};

// Send incident alert email
const sendIncidentAlert = async (incident, userEmail) => {
  const html =
    '<h1>Incident Alert</h1>' +
    '<p><strong>Type:</strong> ' + incident.type + '</p>' +
    '<p><strong>Severity:</strong> ' + incident.severity + '</p>' +
    '<p><strong>Description:</strong> ' + (incident.description || 'No description') + '</p>' +
    '<p><strong>Location:</strong> ' + (incident.location_name || 'Unknown') + '</p>' +
    '<p><strong>Status:</strong> ' + incident.status + '</p>' +
    '<p><strong>Time:</strong> ' + new Date(incident.created_at).toLocaleString() + '</p>' +
    '<hr>' +
    '<p><small>Sent from Campus Security System</small></p>';

  return await sendEmail(userEmail, 'Incident Alert: ' + incident.type.toUpperCase(), html);
};

module.exports = {
  sendEmail,
  sendIncidentAlert,
  verifyEmailTransporter,
  getEmailServiceConfig,
  getEmailServiceStatus,
  getEmailTransportDiagnostic,
  formatEmailError,
  get emailServiceConfigured() {
    return getEmailServiceConfig().configured;
  }
};
