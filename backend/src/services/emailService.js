// src/services/emailService.js
const nodemailer = require('nodemailer');

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Send email function
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER,
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

module.exports = { sendEmail, sendIncidentAlert };
