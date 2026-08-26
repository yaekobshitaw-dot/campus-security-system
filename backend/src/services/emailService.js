// src/services/emailService.js
const nodemailer = require('nodemailer');

const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = String(process.env.SMTP_USER || '').trim();
const smtpPass = String(process.env.SMTP_PASS || '').trim();
const smtpFrom = String(process.env.SMTP_FROM || smtpUser).trim();
const hasUsableValue = (value) => value && !value.startsWith('change_me_') && !value.startsWith('YOUR_');
const emailServiceConfigured = Boolean(
  hasUsableValue(process.env.SMTP_HOST) &&
  hasUsableValue(smtpUser) &&
  hasUsableValue(smtpPass) &&
  hasUsableValue(smtpFrom)
);

const transporter = emailServiceConfigured
  ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: true }
  })
  : null;

let transporterVerified = false;

const verifyEmailTransporter = async () => {
  if (!emailServiceConfigured) {
    console.warn('Password reset email service is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, and FRONTEND_URL to enable it.');
    return false;
  }

  if (!transporterVerified) {
    await transporter.verify();
    transporterVerified = true;
  }

  return true;
};

// Send email function
const sendEmail = async (to, subject, html) => {
  try {
    if (!(await verifyEmailTransporter())) {
      throw new Error('Password reset email service is not configured');
    }

    const mailOptions = {
      from: smtpFrom,
      to: to,
      subject: subject,
      html: html
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email error:', error.message);
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
  emailServiceConfigured
};
