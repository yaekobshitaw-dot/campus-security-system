// backend/src/scripts/resetAdminPassword.js
/**
 * Secure admin password reset utility
 * 
 * Usage:
 *   node resetAdminPassword.js --password "NewSecurePassword123"
 *   ADMIN_PASSWORD="NewSecurePassword123" node resetAdminPassword.js
 * 
 * IMPORTANT:
 *   - Do NOT pass passwords in npm scripts or .env files
 *   - Use command-line argument or environment variable
 *   - Only admin users can be reset via this mechanism
 *   - Password must be at least 8 characters
 */

const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

const bcrypt = require('bcryptjs');
const { User, sequelize } = require('../models');

// Parse command-line arguments
const args = process.argv.slice(2);
let newPassword = null;

// Check for --password argument
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--password' && i + 1 < args.length) {
    newPassword = args[i + 1];
    break;
  }
}

// Fall back to environment variable
if (!newPassword) {
  newPassword = process.env.ADMIN_PASSWORD;
}

async function resetAdminPassword() {
  try {
    // Validate input
    if (!newPassword) {
      console.error('❌ Error: No password provided');
      console.error('Usage:');
      console.error('  node resetAdminPassword.js --password "NewPassword123"');
      console.error('  or set ADMIN_PASSWORD environment variable');
      process.exit(1);
    }

    if (newPassword.length < 8) {
      console.error('❌ Error: Password must be at least 8 characters');
      process.exit(1);
    }

    // Verify database connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful');

    // Find admin user
    const adminUser = await User.findOne({
      where: { role: 'admin' }
    });

    if (!adminUser) {
      console.error('❌ Error: No admin user found in database');
      console.error('   Please create an admin account first');
      process.exit(1);
    }

    console.log(`ℹ️  Found admin user: ${adminUser.email} (${adminUser.name})`);

    // Hash the new password using bcryptjs (same mechanism as User model)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    console.log('ℹ️  Hashing new password...');

    // Update the password - IMPORTANT: Update password_hash directly to bypass hooks
    await User.update(
      { password_hash: hashedPassword },
      { where: { role: 'admin' } }
    );

    console.log('✅ Admin password updated successfully');

    // Verify the change by loading the user and testing password comparison
    const updatedUser = await User.findOne({
      where: { role: 'admin' }
    });

    const isPasswordValid = await updatedUser.comparePassword(newPassword);
    if (!isPasswordValid) {
      console.error('❌ Verification failed: Password does not match');
      process.exit(1);
    }

    console.log('✅ Password verification successful');
    console.log('\n📋 Summary:');
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Name: ${updatedUser.name}`);
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   Status: ${updatedUser.is_active ? 'active' : 'inactive'}`);
    console.log(`   Updated at: ${updatedUser.updated_at}`);
    console.log('\n✅ Admin password reset completed successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Password reset failed:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

resetAdminPassword();
