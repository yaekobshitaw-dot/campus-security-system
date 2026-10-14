const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'maintenance-emergency-test-secret';

const { authenticate, authenticateEmergency, authorize } = require('../src/middleware/auth');
const { Incident, SecuritySession, SystemSetting, User } = require('../src/models');
const incidentController = require('../src/controllers/incidentController');
const incidentRoutes = require('../src/routes/incidentRoutes');
const responseRoutes = require('../src/routes/responseRoutes');
const app = require('../src/app');
const { apiLimiter } = require('../src/middleware/rateLimiter');

const originalUserFindByPk = User.findByPk;
const originalSessionFindOne = SecuritySession.findOne;
const originalSettingFindByPk = SystemSetting.findByPk;
const originalIncidentCreate = Incident.create;

test.afterEach(() => {
    User.findByPk = originalUserFindByPk;
    SecuritySession.findOne = originalSessionFindOne;
    SystemSetting.findByPk = originalSettingFindByPk;
    Incident.create = originalIncidentCreate;
});

const makeResponse = () => ({
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; },
});

const makeRequest = (role, { active = true, sessionExists = true, userId = `${role}-1` } = {}) => {
    User.findByPk = async() => ({ user_id: userId, role, is_active: active });
    SecuritySession.findOne = async() => sessionExists ? ({ session_id: 'session-1', user_id: userId }) : null;
    SystemSetting.findByPk = async(key) => key === 'system.active' ? ({ value: 'false' }) : null;
    const token = jwt.sign({ user_id: userId, sid: 'session-1' }, process.env.JWT_SECRET);
    return { headers: { authorization: `Bearer ${token}` }, userId };
};

const getRouteLayer = (router, method, path) => router.stack
    .find((layer) => layer.route ? .path === path && layer.route.methods[method]);
const getRoute = (router, method, path) => getRouteLayer(router, method, path) ? .route;

const runRouteAuthorization = async(route, req) => {
    const res = makeResponse();
    let authenticated = false;
    await route.stack[0].handle(req, res, () => { authenticated = true; });
    if (!authenticated) return { res, authenticated, authorized: false };
    let authorized = false;
    route.stack[1].handle(req, res, () => { authorized = true; });
    return { res, authenticated, authorized };
};

test('maintenance permits only authenticated, role-authorized emergency submission and response routes', async() => {
    const normalAuthIndex = incidentRoutes.stack.findIndex((layer) => layer.handle === authenticate);
    assert.notEqual(normalAuthIndex, -1);

    const emergencyRoutes = [
        ['post', '/sos', 'student'],
        ['post', '/', 'faculty'],
        ['get', '/responses/pending', 'security'],
        ['post', '/responses/:response_id/accept', 'security_officer'],
        ['post', '/responses/:response_id/decline', 'security'],
        ['patch', '/:incident_id/response', 'security_officer'],
        ['get', '/:incident_id/evidence/:filename', 'security'],
    ];

    for (const [method, path, role] of emergencyRoutes) {
        const routeLayer = getRouteLayer(incidentRoutes, method, path);
        const route = routeLayer ? .route;
        assert.ok(route, `${method.toUpperCase()} ${path} route exists`);
        assert.ok(incidentRoutes.stack.indexOf(routeLayer) < normalAuthIndex, `${path} must be registered before router-wide maintenance auth`);
        assert.equal(route.stack[0].handle, authenticateEmergency);
        const result = await runRouteAuthorization(route, makeRequest(role));
        assert.equal(result.authenticated, true, `${path} authenticates the user during maintenance`);
        assert.equal(result.authorized, true, `${path} keeps its role policy during maintenance`);
    }

    assert.equal(responseRoutes.stack[0].handle, authenticateEmergency);
});

test('maintenance does not bypass account, session, or role authorization for emergency submission', async() => {
    const sosRoute = getRoute(incidentRoutes, 'post', '/sos');
    const inactive = await runRouteAuthorization(sosRoute, makeRequest('student', { active: false }));
    assert.equal(inactive.authenticated, false);
    assert.equal(inactive.res.statusCode, 401);

    const revoked = await runRouteAuthorization(sosRoute, makeRequest('student', { sessionExists: false }));
    assert.equal(revoked.authenticated, false);
    assert.equal(revoked.res.statusCode, 401);

    const wrongRole = await runRouteAuthorization(sosRoute, makeRequest('guest'));
    assert.equal(wrongRole.authenticated, true);
    assert.equal(wrongRole.authorized, false);
    assert.equal(wrongRole.res.statusCode, 403);
});

test('ordinary incident operations remain behind maintenance while admins retain recovery access', async() => {
    const normalAuthLayer = incidentRoutes.stack.find((layer) => layer.handle === authenticate);
    const incidentListRoute = getRoute(incidentRoutes, 'get', '/');
    assert.ok(normalAuthLayer);
    assert.ok(incidentRoutes.stack.indexOf(normalAuthLayer) < incidentRoutes.stack.findIndex((layer) => layer.route === incidentListRoute));

    const blockedResponse = makeResponse();
    let ordinaryRouteReached = false;
    await authenticate(makeRequest('student'), blockedResponse, () => { ordinaryRouteReached = true; });
    assert.equal(ordinaryRouteReached, false);
    assert.equal(blockedResponse.statusCode, 503);
    assert.equal(blockedResponse.payload.code, 'SYSTEM_DEACTIVATED');

    const adminResponse = makeResponse();
    let adminRouteReached = false;
    await authenticate(makeRequest('admin'), adminResponse, () => { adminRouteReached = true; });
    assert.equal(adminRouteReached, true);
});

test('the global API rate limiter remains mounted before emergency routes', () => {
    const limiterIndex = app._router.stack.findIndex((layer) => layer.handle === apiLimiter);
    const incidentsIndex = app._router.stack.findIndex((layer) => layer.handle === incidentRoutes);
    assert.notEqual(limiterIndex, -1);
    assert.notEqual(incidentsIndex, -1);
    assert.ok(limiterIndex < incidentsIndex);
});

test('SOS and incident reporting return an error when the incident database write fails', async() => {
    Incident.create = async() => { throw new Error('database unavailable'); };
    SystemSetting.findByPk = async() => null;

    const sosResponse = makeResponse();
    await incidentController.createSOS({
        user: { user_id: 'sos-db-failure-user', role: 'student' },
        body: {},
    }, sosResponse);
    assert.equal(sosResponse.statusCode, 500);

    const incidentResponse = makeResponse();
    await incidentController.create({
        user: { user_id: 'incident-db-failure-user', role: 'student' },
        body: { type: 'security_threat', is_sos: true },
        files: [],
    }, incidentResponse);
    assert.equal(incidentResponse.statusCode, 500);
});