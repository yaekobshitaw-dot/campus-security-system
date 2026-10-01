const test = require('node:test');
const assert = require('node:assert/strict');
const incidentRoutes = require('../src/routes/incidentRoutes');
const { authorize } = require('../src/middleware/auth');

const response = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; },
});

const routeAuthorization = (method, routePath) => {
  const route = incidentRoutes.stack.find((layer) => (
    layer.route?.path === routePath && layer.route.methods[method]
  ));
  assert.ok(route, `expected ${method.toUpperCase()} ${routePath} route`);
  return route.route.stack[0].handle;
};

test('only students, faculty, and staff can create an incident', () => {
  const authorizeCreate = routeAuthorization('post', '/');
  for (const role of ['student', 'faculty', 'staff']) {
    let reachedHandler = false;
    authorizeCreate({ user: { role } }, response(), () => { reachedHandler = true; });
    assert.equal(reachedHandler, true, `${role} should be allowed to report`);
  }
  for (const role of ['admin', 'security_officer', 'security']) {
    const res = response();
    let reachedHandler = false;
    authorizeCreate({ user: { role } }, res, () => { reachedHandler = true; });
    assert.equal(reachedHandler, false, `${role} must not report`);
    assert.equal(res.statusCode, 403);
  }
});

test('only students, faculty, and staff can create SOS alerts', () => {
  const authorizeSOS = routeAuthorization('post', '/sos');
  for (const role of ['student', 'faculty', 'staff']) {
    let reachedHandler = false;
    authorizeSOS({ user: { role } }, response(), () => { reachedHandler = true; });
    assert.equal(reachedHandler, true, `${role} should be allowed to send SOS`);
  }
  for (const role of ['admin', 'security_officer', 'security']) {
    const res = response();
    let reachedHandler = false;
    authorizeSOS({ user: { role } }, res, () => { reachedHandler = true; });
    assert.equal(reachedHandler, false, `${role} must not send SOS`);
    assert.equal(res.statusCode, 403);
  }
});

test('only Admin can create officer assignments', () => {
  const authorizeAssign = routeAuthorization('post', '/:incident_id/assign');
  let adminReachedHandler = false;
  authorizeAssign({ user: { role: 'admin' } }, response(), () => { adminReachedHandler = true; });
  assert.equal(adminReachedHandler, true);

  for (const role of ['student', 'faculty', 'staff', 'security_officer', 'security']) {
    const res = response();
    let reachedHandler = false;
    authorizeAssign({ user: { role } }, res, () => { reachedHandler = true; });
    assert.equal(reachedHandler, false, `${role} must not assign officers`);
    assert.equal(res.statusCode, 403);
  }
});

test('security officer cannot directly change arbitrary incident status', () => {
  const authorizeStatus = routeAuthorization('patch', '/:incident_id/status');
  let adminReachedHandler = false;
  authorizeStatus({ user: { role: 'admin' } }, response(), () => { adminReachedHandler = true; });
  assert.equal(adminReachedHandler, true);

  for (const role of ['security_officer', 'security']) {
    const res = response();
    let reachedHandler = false;
    authorizeStatus({ user: { role } }, res, () => { reachedHandler = true; });
    assert.equal(reachedHandler, false);
    assert.equal(res.statusCode, 403);
  }
});

test('existing role middleware continues to allow Admin and deny students for Admin-only operations', () => {
  const adminOnly = authorize('admin');
  let adminReachedHandler = false;
  adminOnly({ user: { role: 'admin' } }, response(), () => { adminReachedHandler = true; });
  assert.equal(adminReachedHandler, true);

  const res = response();
  let studentReachedHandler = false;
  adminOnly({ user: { role: 'student' } }, res, () => { studentReachedHandler = true; });
  assert.equal(studentReachedHandler, false);
  assert.equal(res.statusCode, 403);
});
