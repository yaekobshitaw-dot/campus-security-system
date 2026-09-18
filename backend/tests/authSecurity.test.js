const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.OAUTH_STATE_SECRET = 'test-oauth-state-secret';

const authController = require('../src/controllers/authController');
const oauthService = require('../src/services/oauthService');
const { User, UserIdentity, OAuthLoginTicket } = require('../src/models');

const originalUserUpdate = User.update;
const originalUserFindOne = User.findOne;
const originalUserFindByPk = User.findByPk;
const originalUserCreate = User.create;
const originalIdentityFindOne = UserIdentity.findOne;
const originalIdentityCreate = UserIdentity.create;
const originalTicketUpdate = OAuthLoginTicket.update;
const originalTicketFindOne = OAuthLoginTicket.findOne;
const originalTicketCreate = OAuthLoginTicket.create;

const response = () => ({
  statusCode: null,
  payload: null,
  headers: {},
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; },
  setHeader(name, value) { this.headers[name] = value; }
});

const request = (body = {}) => ({ body, headers: {} });
const makeUser = (overrides = {}) => ({
  user_id: 'user-1',
  name: 'Test User',
  email: 'user@example.com',
  role: 'student',
  is_active: true,
  toJSON() { return { user_id: this.user_id, name: this.name, email: this.email, role: this.role, is_active: this.is_active }; },
  ...overrides
});

test.afterEach(() => {
  User.update = originalUserUpdate;
  User.findOne = originalUserFindOne;
  User.findByPk = originalUserFindByPk;
  User.create = originalUserCreate;
  UserIdentity.findOne = originalIdentityFindOne;
  UserIdentity.create = originalIdentityCreate;
  OAuthLoginTicket.update = originalTicketUpdate;
  OAuthLoginTicket.findOne = originalTicketFindOne;
  OAuthLoginTicket.create = originalTicketCreate;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_CALLBACK_URL;
  delete process.env.MICROSOFT_CLIENT_ID;
  delete process.env.MICROSOFT_CLIENT_SECRET;
  delete process.env.MICROSOFT_CALLBACK_URL;
  oauthService.__resetProviderClients();
});

test('reset password rejects invalid, expired, and already-used tokens through atomic update', async () => {
  const calls = [];
  User.update = async (values, options) => {
    calls.push({ values, options });
    return [0];
  };

  for (const token of ['invalid-token', 'expired-token', 'used-token']) {
    const result = response();
    await authController.resetPassword(request({ token, password: 'NewSecurePassword123!' }), result);
    assert.equal(result.statusCode, 400);
    assert.match(result.payload.message, /invalid or expired/i);
  }

  assert.equal(calls.length, 3);
  assert.ok(calls.every(({ options }) => options.where.reset_token_expires_at));
  assert.ok(calls.every(({ values }) => values.reset_token_hash === null && values.reset_token_expires_at === null));
  assert.ok(calls.every(({ values }) => String(values.password_hash).startsWith('$2')));
});

test('forgot password preserves generic responses and reports missing SMTP safely', async () => {
  const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'FRONTEND_URL'];
  const originalValues = Object.fromEntries(smtpKeys.map((key) => [key, process.env[key]]));

  try {
    smtpKeys.forEach((key) => delete process.env[key]);

    const emptyEmailResponse = response();
    await authController.forgotPassword(request({ email: '' }), emptyEmailResponse);
    assert.equal(emptyEmailResponse.statusCode, 200);
    assert.match(emptyEmailResponse.payload.message, /if an account exists/i);

    const configuredEmailResponse = response();
    await authController.forgotPassword(request({ email: 'user@example.com' }), configuredEmailResponse);
    assert.equal(configuredEmailResponse.statusCode, 503);
    assert.match(configuredEmailResponse.payload.message, /email service is not configured/i);
  } finally {
    smtpKeys.forEach((key) => {
      if (originalValues[key] === undefined) delete process.env[key];
      else process.env[key] = originalValues[key];
    });
  }
});

test('oauth state rejects tampering and preserves PKCE state', () => {
  const state = oauthService.__createStateCookie('google');
  const req = { headers: { cookie: `campus_oauth_google=${encodeURIComponent(state.value)}` } };
  const parsed = oauthService.__readState(req, 'google');
  assert.equal(parsed.state, state.state);
  assert.equal(parsed.codeVerifier, state.codeVerifier);

  const tampered = state.value.replace(/.$/, state.value.endsWith('a') ? 'b' : 'a');
  assert.throws(() => oauthService.__readState({ headers: { cookie: `campus_oauth_google=${tampered}` } }, 'google'), /invalid|expired/i);
});

test('oauth claim validation rejects unverified email claims', () => {
  assert.throws(
    () => oauthService.__getVerifiedIdentity('google', { claims: () => ({ sub: 'google-1', email: 'user@example.com', email_verified: false }) }),
    /verified email/i
  );
});

test('oauth links an existing user and creates new users with the student role', async () => {
  const existingUser = makeUser({ user_id: 'existing-user' });
  let createdUserAttributes;
  let createdIdentityAttributes;
  UserIdentity.findOne = async () => null;
  UserIdentity.create = async (attributes) => { createdIdentityAttributes = attributes; return attributes; };

  User.findOne = async ({ where }) => (where.email === existingUser.email ? existingUser : null);
  await oauthService.__findOrCreateUser('google', { subject: 'google-existing', email: existingUser.email, name: existingUser.name });
  assert.equal(createdIdentityAttributes.user_id, existingUser.user_id);
  assert.equal(createdIdentityAttributes.provider, 'google');

  const newUser = makeUser({ user_id: 'new-user', email: 'new@example.com' });
  User.findOne = async () => null;
  User.create = async (attributes) => { createdUserAttributes = attributes; return newUser; };
  await oauthService.__findOrCreateUser('microsoft', { subject: 'ms-new', email: newUser.email, name: 'New User' });
  assert.equal(createdUserAttributes.role, 'student');
  assert.equal(createdUserAttributes.email, newUser.email);
});

test('oauth login tickets are single-use and expire', async () => {
  OAuthLoginTicket.update = async () => [0];
  const result = response();
  await authController.oauthExchange(request({ ticket: crypto.randomBytes(16).toString('hex') }), result);
  assert.equal(result.statusCode, 400);
  assert.match(result.payload.message, /invalid or expired/i);
});

test('provider-not-configured path does not redirect as if authentication succeeded', async () => {
  const result = response();
  result.redirect = () => { throw new Error('unexpected redirect'); };
  await oauthService.start({}, result, 'google');
  assert.equal(result.statusCode, 503);
  assert.match(result.payload.message, /not configured/i);
});

for (const provider of ['google', 'microsoft']) {
  test(`${provider} callback validates OIDC state and redirects with a one-time ticket`, async () => {
    process.env[`${provider.toUpperCase()}_CLIENT_ID`] = 'client-id';
    process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] = 'client-secret';
    process.env[`${provider.toUpperCase()}_CALLBACK_URL`] = `http://localhost:5002/api/auth/oauth/${provider}/callback`;
    const state = oauthService.__createStateCookie(provider);
    const user = makeUser({ email: `${provider}@example.com` });
    UserIdentity.findOne = async () => null;
    UserIdentity.create = async () => ({});
    User.findOne = async () => user;
    OAuthLoginTicket.create = async () => ({});
    oauthService.__setProviderClient(provider, {
      callback: async (callbackUrl, params, checks) => {
        assert.equal(callbackUrl, process.env[`${provider.toUpperCase()}_CALLBACK_URL`]);
        assert.equal(params.state, state.state);
        assert.equal(checks.code_verifier, state.codeVerifier);
        return { claims: () => ({ sub: `${provider}-subject`, email: user.email, email_verified: true, name: user.name }) };
      }
    });

    const result = response();
    result.redirect = (url) => { result.redirectUrl = url; return url; };
    await oauthService.callback({
      headers: { cookie: `campus_oauth_${provider}=${encodeURIComponent(state.value)}` },
      query: { state: state.state, code: 'authorization-code' }
    }, result, provider);

    assert.match(result.redirectUrl, /\/oauth\/callback\?ticket=/);
  });
}