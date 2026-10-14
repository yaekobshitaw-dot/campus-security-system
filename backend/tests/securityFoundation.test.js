const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

process.env.MFA_ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || 'test-mfa-encryption-key-with-32-chars';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'security-foundation-test-secret';

const securityService = require('../src/services/securityService');
const authController = require('../src/controllers/authController');
const { authenticate } = require('../src/middleware/auth');
const oauthService = require('../src/services/oauthService');
const { AuditLog, MfaRecoveryCode, Response, SecuritySession, User } = require('../src/models');

const originalFindOne = SecuritySession.findOne;
const originalSessionUpdate = SecuritySession.update;
const originalRecoveryUpdate = MfaRecoveryCode.update;
const originalSessionCreate = SecuritySession.create;
const originalAuditCreate = AuditLog.create;
const originalUserFindOne = User.findOne;
const originalUserFindByPk = User.findByPk;
const originalUserUpdate = User.update;
const originalResponseFindOne = Response.findOne;
const originalExchangeLoginTicket = oauthService.exchangeLoginTicket;
const originalRevokeRefreshSession = securityService.revokeRefreshSession;
const originalRevokeSession = securityService.revokeSession;
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
    User.update = originalUserUpdate;
    Response.findOne = originalResponseFindOne;
    oauthService.exchangeLoginTicket = originalExchangeLoginTicket;
    securityService.revokeRefreshSession = originalRevokeRefreshSession;
    securityService.revokeSession = originalRevokeSession;
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
    comparePassword: async() => true,
    toJSON() { return { user_id: this.user_id, email: this.email, role: this.role }; }
});

const captureAudit = () => {
    const records = [];
    AuditLog.create = async(attributes) => { records.push(attributes); return attributes; };
    return records;
};

const middlewareResponse = () => ({
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; }
});

const accessToken = (sessionId = 'session-1') => jwt.sign({ user_id: 'user-1', sid: sessionId },
    process.env.JWT_SECRET
);

test('active-session access tokens authenticate successfully', async() => {
    User.findByPk = async() => authUser('admin');
    SecuritySession.findOne = async({ where }) => {
        assert.equal(where.session_id, 'session-1');
        assert.equal(where.user_id, 'user-1');
        return { session_id: 'session-1', user_id: 'user-1', revoked_at: null, expires_at: new Date(Date.now() + 60000) };
    };
    const request = { headers: { authorization: `Bearer ${accessToken()}` } };
    const response = middlewareResponse();
    let called = false;

    await authenticate(request, response, () => { called = true; });

    assert.equal(called, true);
    assert.equal(response.statusCode, null);
    assert.equal(request.authenticatedSessionId, 'session-1');
});

test('revoked-session access tokens are rejected', async() => {
    User.findByPk = async() => authUser('admin');
    SecuritySession.findOne = async() => null;
    const response = middlewareResponse();
    let called = false;

    await authenticate({ headers: { authorization: `Bearer ${accessToken()}` } }, response, () => { called = true; });

    assert.equal(called, false);
    assert.equal(response.statusCode, 401);
});

test('revokeSession updates only the requested unrevoked session for its owner', async() => {
    let updateValues;
    let updateOptions;
    SecuritySession.update = async(values, options) => {
        updateValues = values;
        updateOptions = options;
        return [1];
    };

    assert.equal(await securityService.revokeSession('session-1', 'user-1'), 'session-1');
    assert.equal(updateOptions.where.session_id, 'session-1');
    assert.equal(updateOptions.where.user_id, 'user-1');
    assert.equal(updateOptions.where.revoked_at, null);
    assert.ok(updateOptions.where.expires_at);
    assert.ok(updateValues.revoked_at instanceof Date);
    assert.equal(updateValues.last_active_at, updateValues.revoked_at);

    SecuritySession.update = async() => [0];
    assert.equal(await securityService.revokeSession('session-1', 'user-1'), false);
});

test('logout revokes only the submitted refresh token and works without access authentication', async() => {
    const audited = captureAudit();
    const revokedTokens = [];
    const sessionASocket = { sessionId: 'session-a', disconnected: false, emit() {}, disconnect() { this.disconnected = true; } };
    const sessionBSocket = { sessionId: 'session-b', disconnected: false, emit() {}, disconnect() { this.disconnected = true; } };
    securityService.revokeRefreshSession = async(token) => {
        revokedTokens.push(token);
        return token === 'valid-refresh-token' ? 'session-a' : false;
    };

    const response = authResponse();
    const request = {
        body: { refreshToken: 'valid-refresh-token' },
        get: () => 'test-agent',
        app: { get: () => ({ sockets: { sockets: new Map([['a', sessionASocket], ['b', sessionBSocket]]) } }) }
    };
    await authController.logout(request, response);

    assert.deepEqual(revokedTokens, ['valid-refresh-token']);
    assert.equal(response.statusCode, 200);
    assert.equal(audited.find((record) => record.action === 'logout').actor_id, null);
    assert.equal(sessionASocket.disconnected, true);
    assert.equal(sessionBSocket.disconnected, false);

    const invalidResponse = authResponse();
    await authController.logout({...request, body: { refreshToken: 'wrong-refresh-token' } }, invalidResponse);
    assert.equal(invalidResponse.statusCode, 401);
});

test('MFA secrets encrypt and decrypt without exposing the original storage value', () => {
    const secret = securityService.generateBase32Secret();
    const encrypted = securityService.encryptSecret(secret);

    assert.notEqual(encrypted, secret);
    assert.equal(securityService.decryptSecret(encrypted), secret);
});

test('concurrent pending MFA setup requests return the persisted winner', async() => {
    const persistedUser = { user_id: 'user-1', mfa_secret_hash: null };
    let updateAttempts = 0;
    User.update = async(values, { where }) => {
        assert.equal(where.user_id, persistedUser.user_id);
        assert.equal(where.mfa_secret_hash, null);
        updateAttempts += 1;
        if (persistedUser.mfa_secret_hash) return [0];
        persistedUser.mfa_secret_hash = values.mfa_secret_hash;
        return [1];
    };
    User.findByPk = async() => ({ mfa_secret_hash: persistedUser.mfa_secret_hash });

    const [firstSecret, secondSecret] = await Promise.all([
        securityService.getPendingMfaSecret({ user_id: persistedUser.user_id, mfa_secret_hash: null }),
        securityService.getPendingMfaSecret({ user_id: persistedUser.user_id, mfa_secret_hash: null })
    ]);

    assert.equal(firstSecret, secondSecret);
    assert.equal(updateAttempts, 2);
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

test('refresh rotation revokes the old session and updates its activity timestamp', async() => {
    let updateValues;
    SecuritySession.update = async(values, { where }) => {
        assert.equal(where.refresh_token_hash, securityService.hash('refresh-token'));
        updateValues = values;
        return [1];
    };
    SecuritySession.findOne = async() => ({ session_id: 'session-1', user_id: 'user-1' });

    const session = await securityService.rotateRefreshSession('refresh-token');

    assert.ok(session);
    assert.ok(updateValues.revoked_at instanceof Date);
    assert.equal(updateValues.last_active_at, updateValues.revoked_at);
});

test('refresh revocation only updates a valid, unrevoked session', async() => {
    const sessions = new Map([
        [securityService.hash('valid-token'), { session_id: 'session-valid', expires_at: new Date(Date.now() + 60000), revoked_at: null }],
        [securityService.hash('expired-token'), { session_id: 'session-expired', expires_at: new Date(Date.now() - 60000), revoked_at: null }],
        [securityService.hash('revoked-token'), { session_id: 'session-revoked', expires_at: new Date(Date.now() + 60000), revoked_at: new Date() }]
    ]);
    const lookups = [];
    SecuritySession.update = async(values, { where }) => {
        assert.match(where.refresh_token_hash, /^[a-f0-9]{64}$/);
        assert.equal(where.revoked_at, null);
        assert.ok(where.expires_at[Op.gt] instanceof Date);
        assert.ok(values.revoked_at instanceof Date);
        const session = sessions.get(where.refresh_token_hash);
        if (!session || session.revoked_at || session.expires_at <= where.expires_at[Op.gt]) return [0];
        session.revoked_at = values.revoked_at;
        return [1];
    };
    SecuritySession.findOne = async({ where }) => {
        lookups.push(where.refresh_token_hash);
        return sessions.get(where.refresh_token_hash) || null;
    };

    assert.equal(await securityService.revokeRefreshSession(''), false);
    assert.equal(await securityService.revokeRefreshSession(null), false);
    assert.equal(await securityService.revokeRefreshSession('valid-token'), 'session-valid');
    assert.equal(await securityService.revokeRefreshSession('expired-token'), false);
    assert.equal(await securityService.revokeRefreshSession('unknown-token'), false);
    assert.equal(await securityService.revokeRefreshSession('malformed-token'), false);
    assert.equal(await securityService.revokeRefreshSession('revoked-token'), false);
    assert.deepEqual(lookups, [securityService.hash('valid-token')]);
});

test('logout does not report success when an expired refresh token updates no session', async() => {
    const refreshToken = 'expired-logout-token';
    SecuritySession.update = async(values, { where }) => {
        assert.equal(where.refresh_token_hash, securityService.hash(refreshToken));
        assert.equal(where.revoked_at, null);
        assert.ok(where.expires_at[Op.gt] instanceof Date);
        assert.ok(values.revoked_at instanceof Date);
        return [0];
    };
    const response = authResponse();

    await authController.logout({ body: { refreshToken }, app: { get: () => null } }, response);

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.payload, { success: false, message: 'Logout credentials are invalid or expired' });
});

test('concurrent refresh reuse allows only one conditional update', async() => {
    let attempts = 0;
    SecuritySession.update = async() => [attempts++ === 0 ? 1 : 0];
    SecuritySession.findOne = async() => ({ session_id: 'session-1', user_id: 'user-1' });

    const results = await Promise.all([
        securityService.rotateRefreshSession('same-token'),
        securityService.rotateRefreshSession('same-token')
    ]);

    assert.equal(results.filter(Boolean).length, 1);
});

test('concurrent recovery-code reuse allows only one conditional update', async() => {
    let attempts = 0;
    MfaRecoveryCode.update = async() => [attempts++ === 0 ? 1 : 0];

    const results = await Promise.all([
        securityService.consumeRecoveryCodeAtomic('user-1', 'recovery-code'),
        securityService.consumeRecoveryCodeAtomic('user-1', 'recovery-code')
    ]);

    assert.deepEqual(results.sort(), [false, true]);
});

for (const role of['student', 'admin']) {
    test(`${role} password login audit identifies the authenticated actor`, async() => {
        const user = authUser(role);
        const records = captureAudit();
        User.findOne = async() => user;
        SecuritySession.create = async() => ({ session_id: 'session-1' });
        const response = authResponse();

        await authController.login(authRequest({ email: user.email, password: 'password123' }), response);

        const loginAudit = records.find((record) => record.action === 'login');
        assert.equal(loginAudit.actor_id, user.user_id);
    });
}

test('password login restores security officer availability', async() => {
    const user = {
        ...authUser('security'),
        availability_status: 'offline',
        async update(values) { Object.assign(this, values); },
        toJSON() {
            return { user_id: this.user_id, email: this.email, role: this.role, availability_status: this.availability_status };
        }
    };
    captureAudit();
    User.findOne = async() => user;
    SecuritySession.create = async() => ({ session_id: 'session-1' });
    Response.findOne = async() => null;
    const response = authResponse();

    await authController.login(authRequest({ email: user.email, password: 'password123' }), response);

    assert.equal(user.availability_status, 'available');
    assert.equal(response.payload.data.user.availability_status, 'available');
});

test('MFA login audit identifies the authenticated actor', async() => {
    const user = {...authUser('student'), mfa_enabled: true, mfa_secret_hash: 'encrypted-secret' };
    const records = captureAudit();
    User.findByPk = async() => user;
    SecuritySession.create = async() => ({ session_id: 'session-1' });
    Response.findOne = async() => null;
    securityService.verifyMfaChallenge = () => ({ user_id: user.user_id });
    securityService.consumeRecoveryCodeAtomic = async() => true;
    const response = authResponse();

    await authController.verifyMfaLogin(authRequest({ recoveryCode: 'recovery-code' }), response);

    assert.equal(records.find((record) => record.action === 'login').actor_id, user.user_id);
});

test('successful MFA login restores a security officer availability status', async() => {
    const user = {
        ...authUser('security'),
        mfa_enabled: true,
        mfa_secret_hash: 'encrypted-secret',
        availability_status: 'offline',
        async update(values) { Object.assign(this, values); },
        toJSON() {
            return { user_id: this.user_id, email: this.email, role: this.role, availability_status: this.availability_status };
        }
    };
    User.findByPk = async() => user;
    SecuritySession.create = async() => ({ session_id: 'session-1' });
    Response.findOne = async() => null;
    securityService.verifyMfaChallenge = () => ({ user_id: user.user_id });
    securityService.consumeRecoveryCodeAtomic = async() => true;
    const response = authResponse();

    await authController.verifyMfaLogin(authRequest({ recoveryCode: 'recovery-code' }), response);

    assert.equal(user.availability_status, 'available');
    assert.equal(response.payload.data.user.availability_status, 'available');
});

test('MFA login preserves a security officer active incident response', async() => {
    const user = {
        ...authUser('security'),
        mfa_enabled: true,
        mfa_secret_hash: 'encrypted-secret',
        availability_status: 'offline',
        async update(values) { Object.assign(this, values); },
        toJSON() {
            return { user_id: this.user_id, email: this.email, role: this.role, availability_status: this.availability_status };
        }
    };
    User.findByPk = async() => user;
    SecuritySession.create = async() => ({ session_id: 'session-1' });
    securityService.verifyMfaChallenge = () => ({ user_id: user.user_id });
    securityService.consumeRecoveryCodeAtomic = async() => true;
    Response.findOne = async() => ({ responder_id: user.user_id, status: 'responding' });
    const response = authResponse();

    await authController.verifyMfaLogin(authRequest({ recoveryCode: 'recovery-code' }), response);

    assert.equal(user.availability_status, 'responding');
    assert.equal(response.payload.data.user.availability_status, 'responding');
});

test('OAuth login restores security officer availability', async() => {
    const user = {
        ...authUser('security'),
        availability_status: 'offline',
        async update(values) { Object.assign(this, values); },
        toJSON() {
            return { user_id: this.user_id, email: this.email, role: this.role, availability_status: this.availability_status };
        }
    };
    captureAudit();
    oauthService.exchangeLoginTicket = async() => user;
    SecuritySession.create = async() => ({ session_id: 'session-1' });
    Response.findOne = async() => null;
    const response = authResponse();

    await authController.oauthExchange(authRequest({ ticket: 'one-time-ticket' }), response);

    assert.equal(user.availability_status, 'available');
    assert.equal(response.payload.data.user.availability_status, 'available');
});

test('OAuth login audit identifies the authenticated actor', async() => {
    const user = authUser('student');
    const records = captureAudit();
    oauthService.exchangeLoginTicket = async() => user;
    SecuritySession.create = async() => ({ session_id: 'session-1' });
    const response = authResponse();

    await authController.oauthExchange(authRequest({ ticket: 'one-time-ticket' }), response);

    assert.equal(records.find((record) => record.action === 'login').actor_id, user.user_id);
});

test('logout revokes the validated bearer session when refresh storage is unavailable', async() => {
    const audited = captureAudit();
    const sessionSocket = { sessionId: 'session-a', disconnected: false, emit() {}, disconnect() { this.disconnected = true; } };
    const revokeCalls = [];
    securityService.revokeSession = async(sessionId, userId) => {
        revokeCalls.push({ sessionId, userId });
        return sessionId;
    };
    securityService.revokeRefreshSession = async() => assert.fail('valid bearer session should be preferred');
    const response = authResponse();
    const request = {
        body: {},
        user: authUser('student'),
        authenticatedSessionId: 'session-a',
        get: () => 'test-agent',
        app: { get: () => ({ sockets: { sockets: new Map([['a', sessionSocket]]) } }) }
    };

    await authController.logout(request, response);

    assert.deepEqual(revokeCalls, [{ sessionId: 'session-a', userId: 'student-1' }]);
    assert.equal(response.statusCode, 200);
    assert.equal(sessionSocket.disconnected, true);
    assert.equal(audited.find((record) => record.action === 'logout').actor_id, 'student-1');
});