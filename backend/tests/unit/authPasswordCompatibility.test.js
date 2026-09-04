const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');

test('comparePassword accepts legacy plain-text passwords and bcrypt hashes', async () => {
  const legacyUser = User.build({
    email: 'legacy@example.com',
    name: 'Legacy User',
    password_hash: 'LegacyPassword123!',
    role: 'student'
  });

  assert.equal(await legacyUser.comparePassword('LegacyPassword123!'), true);

  const hashedUser = User.build({
    email: 'hashed@example.com',
    name: 'Hashed User',
    password_hash: await bcrypt.hash('SecurePassword123!', 10),
    role: 'student'
  });

  assert.equal(await hashedUser.comparePassword('SecurePassword123!'), true);
  assert.equal(await hashedUser.comparePassword('WrongPassword'), false);
});
