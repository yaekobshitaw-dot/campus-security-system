const test = require('node:test');
const assert = require('node:assert/strict');
const { authorize } = require('../src/middleware/auth');
const userRoutes = require('../src/routes/userRoutes');
const { User, Response } = require('../src/models');

// We'll test the handler function directly via the exported router.updateAvailabilityHandler
const updateHandler = userRoutes.updateAvailabilityHandler;
const originalResponseFindOne = Response.findOne;

test.beforeEach(() => {
    Response.findOne = async() => null;
});

test.afterEach(() => {
    Response.findOne = originalResponseFindOne;
});

function makeResp() {
    return { statusCode: null, payload: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return payload; } };
}

test('security role user can set availability to available', async() => {
    const mockUser = { user_id: 'u1', role: 'security', async update(values) { Object.assign(this, values); }, toJSON() { return this; } };
    const req = { body: { availability_status: 'available' }, user: mockUser, app: { get: () => null } };
    const res = makeResp();
    await updateHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(mockUser.availability_status, 'available');
});

test('legacy security_officer role can set availability to offline', async() => {
    const mockUser = { user_id: 'u2', role: 'security_officer', async update(values) { Object.assign(this, values); }, toJSON() { return this; } };
    const req = { body: { availability_status: 'offline' }, user: mockUser, app: { get: () => null } };
    const res = makeResp();
    await updateHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(mockUser.availability_status, 'offline');
});

test('reject invalid availability value', async() => {
    const mockUser = { user_id: 'u3', role: 'security', async update() {}, toJSON() { return this; } };
    const req = { body: { availability_status: 'sleeping' }, user: mockUser, app: { get: () => null } };
    const res = makeResp();
    await updateHandler(req, res);
    assert.equal(res.statusCode, 400);
});

test('responding officer cannot go offline', async() => {
    const mockUser = { user_id: 'u4', role: 'security', async update() {}, toJSON() { return this; } };
    Response.findOne = async() => ({ responder_id: mockUser.user_id, status: 'responding' });
    const req = { body: { availability_status: 'offline' }, user: mockUser, app: { get: () => null } };
    const res = makeResp();
    await updateHandler(req, res);
    assert.equal(res.statusCode, 400);
});

test('responding officer cannot set availability to available', async() => {
    const mockUser = {
        user_id: 'u5',
        role: 'security',
        availability_status: 'responding',
        async update(values) { Object.assign(this, values); }
    };
    Response.findOne = async() => ({ responder_id: mockUser.user_id, status: 'responding' });
    const req = { body: { availability_status: 'available' }, user: mockUser, app: { get: () => null } };
    const res = makeResp();

    await updateHandler(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(mockUser.availability_status, 'responding');
});

test('admin can mark a selected signed-in security officer available and persist the change', async() => {
    const route = userRoutes.stack.find((layer) => layer.route?.path === '/:userId/availability').route;
    const adminHandler = route.stack.at(-1).handle;
    const user = {
        user_id: 'officer-5',
        name: 'Officer Five',
        role: 'security_officer',
        availability_status: 'offline',
        async update(values) { Object.assign(this, values); }
    };
    const originalFindOne = User.findOne;
    const originalResponseFindOne = Response.findOne;
    const emitted = [];
    let responseQuery;
    const io = {
        presence: new Map([
            [user.user_id, { count: 1 }]
        ]),
        to(room) { emitted.push({ room }); return this; },
        emit(event, payload) { emitted.push({ event, payload }); }
    };
    User.findOne = async() => user;
    Response.findOne = async(options) => { responseQuery = options; return null; };
    const req = { params: { userId: user.user_id }, body: { availability_status: 'available' }, user: { role: 'admin' }, app: { get: () => io } };
    const res = makeResp();

    try {
        await adminHandler(req, res);
    } finally {
        User.findOne = originalFindOne;
        Response.findOne = originalResponseFindOne;
    }

    assert.equal(res.statusCode, 200);
    assert.equal(user.availability_status, 'available');
    assert.equal(res.payload.data.user_id, user.user_id);
    assert.deepEqual(responseQuery.include[0].where.status, ['reported', 'investigating', 'dispatched', 'on_scene']);
    assert.deepEqual(emitted.filter(({ event }) => event).map(({ event }) => event), ['officer-availability-updated']);
});

test('admin cannot mark an officer available during disconnect grace with no live socket', async() => {
    const route = userRoutes.stack.find((layer) => layer.route?.path === '/:userId/availability').route;
    const adminHandler = route.stack.at(-1).handle;
    const user = {
        user_id: 'officer-6',
        role: 'security',
        availability_status: 'offline',
        async update(values) { Object.assign(this, values); }
    };
    const originalFindOne = User.findOne;
    User.findOne = async() => user;
    const res = makeResp();

    try {
        await adminHandler({
            params: { userId: user.user_id },
            body: { availability_status: 'available' },
            app: {
                get: () => ({
                    presence: new Map([
                        [user.user_id, { count: 0 }]
                    ])
                })
            }
        }, res);
    } finally {
        User.findOne = originalFindOne;
    }

    assert.equal(res.statusCode, 409);
    assert.equal(user.availability_status, 'offline');
});

test('admin cannot mark an officer available while the officer is responding', async() => {
    const route = userRoutes.stack.find((layer) => layer.route?.path === '/:userId/availability').route;
    const adminHandler = route.stack.at(-1).handle;
    const user = {
        user_id: 'officer-7',
        role: 'security',
        availability_status: 'offline',
        async update(values) { Object.assign(this, values); }
    };
    const originalFindOne = User.findOne;
    const originalResponseFindOne = Response.findOne;
    User.findOne = async() => user;
    Response.findOne = async() => ({ responder_id: user.user_id, status: 'responding' });
    const res = makeResp();

    try {
        await adminHandler({
            params: { userId: user.user_id },
            body: { availability_status: 'available' },
            app: {
                get: () => ({
                    presence: new Map([
                        [user.user_id, { count: 1 }]
                    ])
                })
            }
        }, res);
    } finally {
        User.findOne = originalFindOne;
        Response.findOne = originalResponseFindOne;
    }

    assert.equal(res.statusCode, 409);
    assert.equal(user.availability_status, 'offline');
});

test('only admins can use the selected-officer availability route', () => {
    const route = userRoutes.stack.find((layer) => layer.route?.path === '/:userId/availability').route;
    const authorization = route.stack[0].handle;
    const adminResponse = makeResp();
    const officerResponse = makeResp();
    let adminContinued = false;
    let officerContinued = false;

    authorization({ user: { role: 'admin' } }, adminResponse, () => { adminContinued = true; });
    authorization({ user: { role: 'security' } }, officerResponse, () => { officerContinued = true; });

    assert.equal(adminContinued, true);
    assert.equal(officerContinued, false);
    assert.equal(officerResponse.statusCode, 403);
});