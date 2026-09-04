require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_ROLES = ['student', 'faculty', 'staff', 'security', 'admin'];
const DEVELOPMENT_EMAIL_PATTERN = /^campussecure\.dev\.[a-z0-9-]+@example\.com$/i;

const getArgument = (name) => {
  const argumentIndex = process.argv.indexOf(name);
  return argumentIndex >= 0 ? process.argv[argumentIndex + 1] : undefined;
};

const cleanup = process.argv.includes('--cleanup') || process.argv.includes('--reset');
const requestedRole = (getArgument('--role') || process.env.TEST_USER_ROLE || '').trim().toLowerCase();
const effectiveRole = requestedRole || (process.argv.includes('--admin') ? 'admin' : 'student');
const defaultEmail = effectiveRole === 'admin' ? 'campussecure.dev.admin@example.com' : 'campussecure.dev.student@example.com';
const defaultPassword = effectiveRole === 'admin' ? 'DevAdminPass123!' : 'DevTestPass123!';
const email = getArgument('--email') || process.env.TEST_USER_EMAIL || defaultEmail;
const password = getArgument('--password') || process.env.TEST_USER_PASSWORD || defaultPassword;
const role = effectiveRole;

async function createTestUser() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'campus_security'
  });

  try {
    if (cleanup) {
      if (!email || !DEVELOPMENT_EMAIL_PATTERN.test(email)) {
        throw new Error('Cleanup requires an explicitly specified campussecure.dev.*@example.com email.');
      }

      const [result] = await connection.execute('DELETE FROM users WHERE email = ?', [email]);
      console.log(result.affectedRows ? `✓ Removed development test user ${email}` : `✓ No development test user found for ${email}`);
      if (result.affectedRows === 0) {
        console.log('ℹ Continuing with creation using the same development email.');
      }
    }

    if (!email || !password || password.length < 8) {
      throw new Error('A runtime email and password (minimum 8 characters) are required.');
    }
    if (!ALLOWED_ROLES.includes(role)) {
      throw new Error(`Role must be one of: ${ALLOWED_ROLES.join(', ')}.`);
    }

    const [rows] = await connection.execute(
      'SELECT user_id, email, role, is_active FROM users WHERE email = ?',
      [email]
    );

    if (rows.length > 0 && !cleanup) {
      throw new Error(`A user already exists for ${email}; no existing user was modified. Re-run with --reset to recreate it.`);
    } else {
      const userId = uuidv4();
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      await connection.execute(
        'INSERT INTO users (user_id, email, name, role, password_hash, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [userId, email, `CampusSecure Development ${role} Test`, role, passwordHash, true]
      );

      console.log(`✓ Created new ${role} user`);
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
