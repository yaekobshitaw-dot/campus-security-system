// test-ethereal.js - Test email with Ethereal (free)
const nodemailer = require('nodemailer');

async function testEmail() {
  try {
    console.log('Creating test email account...');
    
    // Create test account
    const testAccount = await nodemailer.createTestAccount();
    console.log('✅ Test account created!');
    console.log('📧 Email:', testAccount.user);
    console.log('🔑 Password:', testAccount.pass);
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { 
        user: testAccount.user, 
        pass: testAccount.pass 
      }
    });
    
    // Send email
    const info = await transporter.sendMail({
      from: '"Campus Security" <' + testAccount.user + '>',
      to: 'test@example.com',
      subject: 'Test Email from Campus Security',
      html: '<h1>✅ Working!</h1><p>Your Campus Security System is ready.</p>'
    });
    
    console.log('✅ Email sent!');
    console.log('📨 Preview URL:', nodemailer.getTestMessageUrl(info));
    console.log('💡 Login at: https://ethereal.email/login');
    console.log('📧 Email:', testAccount.user);
    console.log('🔑 Password:', testAccount.pass);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEmail();
