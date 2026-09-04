const test = require('node:test');
const assert = require('node:assert/strict');
const { authorize } = require('../src/middleware/auth');

function makeResponse() {
  const res = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };

  return res;
}

test('authorize blocks non-admin requests for SMS actions', () => {
  const req = { user: { role: 'student' } };
  const res = makeResponse();
  const next = () => {
    throw new Error('next should not be called for non-admin access');
  };

  const result = authorize('admin')(req, res, next);

  assert.equal(result?.statusCode ?? res.statusCode, 403);
  assert.equal(res.payload.success, false);
  assert.match(res.payload.message, /Forbidden: insufficient permissions/i);
});

test('authorize allows admin requests for SMS actions', () => {
  const req = { user: { role: 'admin' } };
  const res = makeResponse();
  let called = false;

  authorize('admin')(req, res, () => {
    called = true;
  });

  assert.equal(called, true);
});
