const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function createTestUser() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Campus@2026#Root',
    database: process.env.DB_NAME || 'campus_security'
  });

  try {
    const email = 'test@test.com';
    const password = 'Password123';
    const role = 'student';

    // Check if user exists
    const [rows] = await connection.execute(
      'SELECT user_id, email, is_active FROM users WHERE email = ?',
      [email]
    );

    if (rows.length > 0) {
      console.log(`✓ User ${email} already exists`);
      console.log(`  user_id: ${rows[0].user_id}`);
      console.log(`  is_active: ${rows[0].is_active}`);

      // Update if not active
      if (!rows[0].is_active) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await connection.execute(
          'UPDATE users SET password_hash = ?, is_active = true, updated_at = NOW() WHERE user_id = ?',
          [passwordHash, rows[0].user_id]
        );
        console.log(`✓ Updated password_hash and activated user`);
      }
    } else {
      // Create new user
      const userId = uuidv4();
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      await connection.execute(
        'INSERT INTO users (user_id, email, name, role, password_hash, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [userId, email, 'Test User', role, passwordHash, true]
      );

      console.log(`✓ Created new user`);
      console.log(`  email: ${email}`);
      console.log(`  user_id: ${userId}`);
      console.log(`  role: ${role}`);
      console.log(`  is_active: true`);
    }

    console.log(`\n✓ Test user ready for authentication`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

createTestUser();
