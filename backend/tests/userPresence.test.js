const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { SecuritySession, User } = require('../src/models');
const { disconnectUserSockets, initSocket } = require('../src/config/socket');
const { authenticate } = require('../src/middleware/auth');
const userRoutes = require('../src/routes/userRoutes');

const originalUserFindByPk = User.findByPk;
const originalUserFindAll = User.findAll;
const originalUserUpdate = User.update;
const originalSessionFindOne = SecuritySession.findOne;
const originalJwtSecret = process.env.JWT_SECRET;

test.beforeEach(() => {
    process.env.JWT_SECRET = 'presence-test-secret';
    User.findByPk = async(userId) => ({
        user_id: userId,
        name: 'Campus Admin',
        role: 'admin',
        is_active: true,
        latitude: null,
        longitude: null,
        availability_status: 'available',
        location_updated_at: null
    });
    User.findAll = originalUserFindAll;
    User.update = async() => [1];
    SecuritySession.findOne = async() => ({ session_id: 'session-1' });
});

test.afterEach(() => {
    User.findByPk = originalUserFindByPk;
    User.findAll = originalUserFindAll;
    User.update = originalUserUpdate;
    SecuritySession.findOne = originalSessionFindOne;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
});

function createFakeIo() {
    const io = {
        middlewares: [],
        handlers: {},
        emissions: [],
        use(handler) { this.middlewares.push(handler); },
        on(event, handler) { this.handlers[event] = handler; },
        to(room) {
            const rooms = [room];
            const target = {
                to(nextRoom) {
                    rooms.push(nextRoom);
                    return target;
                },
                emit(event, payload) {
                    io.emissions.push({ rooms: [...rooms], event, payload });
                }
            };
            return target;
        }
    };
    return io;
}

function createSocket(id, token) {
    const handlers = {};
    return {
        id,
        handshake: { auth: token ? { token } : {} },
        rooms: new Set(),
        serverEmissions: [],
        join(room) { this.rooms.add(room); },
        on(event, handler) { handlers[event] = handler; },
        emit(event, payload) { this.serverEmissions.push({ event, payload }); },
        disconnect() { handlers.disconnect ? .(); }
    };
}

function makeToken(userId = 'admin-1') {
    return jwt.sign({ user_id: userId, sid: 'session-1' }, process.env.JWT_SECRET);
}

async function connectSocket(io, socket) {
    const error = await new Promise((resolve) => io.middlewares[0](socket, resolve));
    if (error) throw error;
    io.handlers.connection(socket);
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test('rejects unauthenticated Socket.IO connections before joining authorized rooms', async() => {
    const io = createFakeIo();
    initSocket(io);
    const socket = createSocket('unauthenticated');
    const error = await new Promise((resolve) => io.middlewares[0](socket, resolve));

    assert.match(error.message, /Authentication required/);
    assert.equal(socket.rooms.has('authenticated'), false);
    assert.equal(io.handlers.connection, undefined);

    SecuritySession.findOne = async() => null;
    const revokedSessionSocket = createSocket('revoked-session', makeToken());
    const revokedSessionError = await new Promise((resolve) => io.middlewares[0](revokedSessionSocket, resolve));
    assert.match(revokedSessionError.message, /Authentication required/);
    assert.equal(revokedSessionSocket.rooms.has('authenticated'), false);
});

test('disconnects all authenticated sockets belonging to a disabled or deleted account', () => {
    const disconnected = [];
    const targetSocket = {
        user: { user_id: 'target-user' },
        disconnect(closeTransport) { disconnected.push({ userId: this.user.user_id, closeTransport }); }
    };
    const otherSocket = {
        user: { user_id: 'other-user' },
        disconnect(closeTransport) { disconnected.push({ userId: this.user.user_id, closeTransport }); }
    };
    const io = {
        sockets: {
            sockets: new Map([
                ['target', targetSocket],
                ['other', otherSocket]
            ])
        }
    };

    disconnectUserSockets(io, 'target-user');

    assert.deepEqual(disconnected, [{ userId: 'target-user', closeTransport: true }]);
});

test('keeps users online across multiple sockets and a reconnect within the grace period', async() => {
    const io = createFakeIo();
    const savedTimestamps = [];
    User.update = async(values, options) => {
        savedTimestamps.push({ values, options });
        return [1];
    };
    initSocket(io, { disconnectGraceMs: 45 });

    const first = createSocket('socket-1', makeToken());
    const second = createSocket('socket-2', makeToken());
    await connectSocket(io, first);
    await connectSocket(io, second);
    assert.equal(io.presence.get('admin-1').count, 2);
    assert.equal(first.rooms.has('authenticated'), true);
    assert.deepEqual(first.serverEmissions[0], {
        event: 'presence-snapshot',
        payload: { online_user_ids: ['admin-1'] }
    });

    first.disconnect();
    assert.equal(io.presence.get('admin-1').count, 1);
    second.disconnect();
    assert.equal(io.presence.get('admin-1').count, 0);
    assert.equal(io.presence.has('admin-1'), true);
    assert.equal(io.emissions.filter(({ event, payload }) => event === 'presence-updated' && !payload.is_online).length, 0);

    await delay(15);
    const reconnected = createSocket('socket-3', makeToken());
    await connectSocket(io, reconnected);
    assert.equal(io.presence.get('admin-1').count, 1);
    await delay(55);
    assert.equal(io.presence.has('admin-1'), true);
    assert.equal(io.emissions.filter(({ event, payload }) => event === 'presence-updated' && !payload.is_online).length, 0);

    reconnected.disconnect();
    await delay(70);
    await Promise.resolve();
    assert.equal(io.presence.has('admin-1'), false);
    const offlineEvents = io.emissions.filter(({ event, payload }) => event === 'presence-updated' && !payload.is_online);
    assert.equal(offlineEvents.length, 1);
    assert.ok(offlineEvents[0].rooms.includes('authenticated'));
    assert.ok(offlineEvents[0].payload.last_seen_at instanceof Date);
    assert.ok(savedTimestamps.some(({ values, options }) => (
        values.last_seen_at instanceof Date && options.silent === true
    )));
});

test('presence directory requires an authorized role and returns only public contact fields', async() => {
    const route = userRoutes.stack.find((layer) => layer.route ? .path === '/presence').route;
    assert.equal(userRoutes.stack[0].handle, authenticate);
    const authorizeRole = route.stack[0].handle;
    const denied = { statusCode: null, status(code) { this.statusCode = code; return this; }, json() {} };
    authorizeRole({ user: { role: 'guest' } }, denied, () => assert.fail('guest must not be authorized'));
    assert.equal(denied.statusCode, 403);

    const offlineAt = new Date('2026-10-01T12:00:00.000Z');
    User.findAll = async(query) => {
        assert.deepEqual(query.attributes, ['user_id', 'name', 'profile_photo_url', 'last_seen_at']);
        assert.deepEqual(query.where, { is_active: true });
        return [
            { user_id: 'online-1', name: 'Online User', profile_photo_url: '/uploads/profile-photos/one.jpg', last_seen_at: offlineAt, password_hash: 'private' },
            { user_id: 'offline-1', name: 'Offline User', profile_photo_url: null, last_seen_at: offlineAt, phone: 'private' }
        ];
    };
    const io = {
        presence: new Map([
            ['online-1', { count: 1 }]
        ])
    };
    const response = {
        statusCode: null,
        payload: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.payload = payload; return payload; }
    };

    await route.stack[1].handle({ app: { get: () => io } }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.payload.data, [
        { user_id: 'online-1', name: 'Online User', profile_photo_url: '/uploads/profile-photos/one.jpg', is_online: true, last_seen_at: null },
        { user_id: 'offline-1', name: 'Offline User', profile_photo_url: null, is_online: false, last_seen_at: offlineAt }
    ]);
    assert.equal(JSON.stringify(response.payload).includes('password_hash'), false);
    assert.equal(JSON.stringify(response.payload).includes('phone'), false);
});