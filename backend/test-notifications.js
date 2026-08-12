// test-notifications.js
const { sendEmail } = require('./src/services/emailService');
const { sendSMS } = require('./src/services/smsService');

async function testNotifications() {
  console.log('Testing Email...');
  try {
    await sendEmail(
      'your-email@gmail.com',
      'Test from Campus Security',
      '<h1>System Working!</h1><p>Your Campus Security System is ready.</p>'
    );
    console.log('Email test passed!');
  } catch (error) {
    console.log('Email test failed:', error.message);
    console.log('Make sure you added SMTP credentials to .env');
  }

  console.log('\nTesting SMS...');
  try {
    await sendSMS(
      '+2519XXXXXXXX',
      'Test from Campus Security System!'
    );
    console.log('SMS test passed!');
  } catch (error) {
    console.log('SMS test failed:', error.message);
    console.log('Make sure you added Twilio credentials to .env');
  }
}

testNotifications();
