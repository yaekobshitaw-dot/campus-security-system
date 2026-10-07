const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MFA_ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || 'test-mfa-encryption-key-with-32-chars';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'security-foundation-test-secret';

const securityService = require('../src/services/securityService');
const authController = require('../src/controllers/authController');
const oauthService = require('../src/services/oauthService');
const { AuditLog, MfaRecoveryCode, SecuritySession, User } = require('../src/models');

const originalFindOne = SecuritySession.findOne;
const originalSessionUpdate = SecuritySession.update;
const originalRecoveryUpdate = MfaRecoveryCode.update;
const originalSessionCreate = SecuritySession.create;
const originalAuditCreate = AuditLog.create;
const originalUserFindOne = User.findOne;
const originalUserFindByPk = User.findByPk;
const originalExchangeLoginTicket = oauthService.exchangeLoginTicket;
const originalVerifyMfaChallenge = securityService.verifyMfaChallenge;
const originalConsumeRecoveryCodeAtomic = securityService.consumeRecoveryCodeAtomic;
test.afterEach(() => {
  SecuritySession.findOne = originalFindOne;
  SecuritySession.update = originalSessionUpdate;
  MfaRecoveryCode.update = originalRecoveryUpdate;
  SecuritySession.create = originalSessionCreate;
  AuditLog.create = originalAuditCreate;
  User.findOne = originalUserFindOne;
  User.findByPk = originalUserFindByPk;
  oauthService.exchangeLoginTicket = originalExchangeLoginTicket;
  securityService.verifyMfaChallenge = originalVerifyMfaChallenge;
  securityService.consumeRecoveryCodeAtomic = originalConsumeRecoveryCodeAtomic;
});

const authResponse = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; }
});

const authRequest = (body) => ({ body, ip: '127.0.0.1', get: () => 'test-agent' });
const authUser = (role = 'student') => ({
  user_id: `${role}-1`,
  email: `${role}@example.com`,
  role,
  is_active: true,
  mfa_enabled: false,
  comparePassword: async () => true,
  toJSON() { return { user_id: this.user_id, email: this.email, role: this.role }; }
});

const captureAudit = () => {
  const records = [];
  AuditLog.create = async (attributes) => { records.push(attributes); return attributes; };
  return records;
};

test('MFA secrets encrypt and decrypt without exposing the original storage value', () => {
  const secret = securityService.generateBase32Secret();
  const encrypted = securityService.encryptSecret(secret);

  assert.notEqual(encrypted, secret);
  assert.equal(securityService.decryptSecret(encrypted), secret);
});

test('recovery codes are hashed and consumed only once', () => {
  const codes = securityService.createRecoveryCodes(2);
  const hashes = securityService.hashRecoveryCodes(codes);

  assert.notDeepEqual(hashes, codes);
  const remaining = securityService.consumeRecoveryCode(hashes, codes[0]);
  assert.deepEqual(remaining, [hashes[1]]);
  assert.equal(securityService.consumeRecoveryCode(remaining, codes[0]), null);
});

test('invalid MFA codes never verify', () => {
  const secret = securityService.generateBase32Secret();
  assert.equal(securityService.verifyTotp(secret, 'not-a-code'), false);
  assert.equal(securityService.verifyTotp(secret, '000000'), false);
});

test('refresh rotation revokes the old session and updates its activity timestamp', async () => {
  let updateValues;
  SecuritySession.update = async (values, { where }) => {
    assert.equal(where.refresh_token_hash, securityService.hash('refresh-token'));
    updateValues = values;
    return [1];
  };
  SecuritySession.findOne = async () => ({ session_id: 'session-1', user_id: 'user-1' });

  const session = await securityService.rotateRefreshSession('refresh-token');

  assert.ok(session);
  assert.ok(updateValues.revoked_at instanceof Date);
  assert.equal(updateValues.last_active_at, updateValues.revoked_at);
});

test('refresh revocation rejects missing, expired, or already revoked sessions', async () => {
  SecuritySession.update = async () => [0];

  assert.equal(await securityService.revokeRefreshSession('missing-token'), false);
  assert.equal(await securityService.rotateRefreshSession('expired-token'), null);
});

test('concurrent refresh reuse allows only one conditional update', async () => {
  let attempts = 0;
  SecuritySession.update = async () => [attempts++ === 0 ? 1 : 0];
  SecuritySession.findOne = async () => ({ session_id: 'session-1', user_id: 'user-1' });

  const results = await Promise.all([
    securityService.rotateRefreshSession('same-token'),
    securityService.rotateRefreshSession('same-token')
  ]);

  assert.equal(results.filter(Boolean).length, 1);
});

test('concurrent recovery-code reuse allows only one conditional update', async () => {
  let attempts = 0;
  MfaRecoveryCode.update = async () => [attempts++ === 0 ? 1 : 0];

  const results = await Promise.all([
    securityService.consumeRecoveryCodeAtomic('user-1', 'recovery-code'),
    securityService.consumeRecoveryCodeAtomic('user-1', 'recovery-code')
  ]);

  assert.deepEqual(results.sort(), [false, true]);
});

for (const role of ['student', 'admin']) {
  test(`${role} password login audit identifies the authenticated actor`, async () => {
    const user = authUser(role);
    const records = captureAudit();
    User.findOne = async () => user;
    SecuritySession.create = async () => ({ session_id: 'session-1' });
    const response = authResponse();

    await authController.login(authRequest({ email: user.email, password: 'password123' }), response);

    const loginAudit = records.find((record) => record.action === 'login');
    assert.equal(loginAudit.actor_id, user.user_id);
  });
}

test('MFA login audit identifies the authenticated actor', async () => {
  const user = { ...authUser('student'), mfa_enabled: true, mfa_secret_hash: 'encrypted-secret' };
  const records = captureAudit();
  User.findByPk = async () => user;
  SecuritySession.create = async () => ({ session_id: 'session-1' });
  securityService.verifyMfaChallenge = () => ({ user_id: user.user_id });
  securityService.consumeRecoveryCodeAtomic = async () => true;
  const response = authResponse();

  await authController.verifyMfaLogin(authRequest({ recoveryCode: 'recovery-code' }), response);

  assert.equal(records.find((record) => record.action === 'login').actor_id, user.user_id);
});

test('OAuth login audit identifies the authenticated actor', async () => {
  const user = authUser('student');
  const records = captureAudit();
  oauthService.exchangeLoginTicket = async () => user;
  SecuritySession.create = async () => ({ session_id: 'session-1' });
  const response = authResponse();

  await authController.oauthExchange(authRequest({ ticket: 'one-time-ticket' }), response);

  assert.equal(records.find((record) => record.action === 'login').actor_id, user.user_id);
});