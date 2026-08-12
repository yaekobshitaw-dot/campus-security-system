// src/services/smsService.js
const twilio = require('twilio');

// Check if Twilio is configured
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

let client = null;
if (accountSid && authToken && accountSid !== 'your_account_sid') {
  client = twilio(accountSid, authToken);
  console.log('✅ Twilio SMS ready');
} else {
  console.log('⚠️ Twilio not configured - SMS disabled');
}

// Send SMS function
const sendSMS = async (to, message) => {
  if (!client) {
    console.log('⚠️ SMS service disabled');
    return { success: false, message: 'SMS service disabled' };
  }
  
  try {
    const response = await client.messages.create({
      body: message,
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER
    });
    console.log('📱 SMS sent:', response.sid);
    return response;
  } catch (error) {
    console.error('❌ SMS error:', error.message);
    throw error;
  }
};

// Send incident alert SMS
const sendIncidentSMS = async (incident, phoneNumber) => {
  const message = 🚨 ALERT:  incident reported. Severity: . Location: . Time: ;
  return await sendSMS(phoneNumber, message);
};

module.exports = { sendSMS, sendIncidentSMS };
