const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const incidentController = require('../src/controllers/incidentController');
const { authenticate } = require('../src/middleware/auth');
const { Incident } = require('../src/models');
const { uploadDirectory } = require('../src/services/evidenceService');

const originalFindByPk = Incident.findByPk;
const filename = `evidence-access-${Date.now()}.png`;
const filePath = path.join(uploadDirectory, filename);

const makeResponse = () => ({
  statusCode: null,
  payload: null,
  sentFile: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return payload;
  },
  sendFile(file) {
    this.sentFile = file;
    return this;
  }
});

const makeIncident = (ownerId = 'student-b') => ({
  incident_id: 'incident-1',
  user_id: ownerId,
  photos: [`/uploads/${filename}`]
});

const requestFor = (user, requestedFilename = filename) => ({
  params: { incident_id: 'incident-1', filename: requestedFilename },
  user
});

test.before(() => {
  fs.mkdirSync(uploadDirectory, { recursive: true });
  fs.writeFileSync(filePath, 'test evidence');
});

test.after(() => {
  fs.rmSync(filePath, { force: true });
  Incident.findByPk = originalFindByPk;
});

test.beforeEach(() => {
  Incident.findByPk = async () => makeIncident();
});

test('rejects an unauthenticated evidence request', () => {
  const response = makeResponse();
  authenticate({ headers: {} }, response, () => { throw new Error('Unauthenticated request was allowed'); });

  assert.equal(response.statusCode, 401);
});

test('rejects student A from accessing student B evidence', async () => {
  const response = makeResponse();
  await incidentController.serveEvidence(requestFor({ user_id: 'student-a', role: 'student' }), response);

  assert.equal(response.statusCode, 404);
  assert.equal(response.sentFile, null);
});

test('allows a student to access their own evidence', async () => {
  const response = makeResponse();
  await incidentController.serveEvidence(requestFor({ user_id: 'student-b', role: 'student' }), response);

  assert.equal(response.statusCode, null);
  assert.equal(response.sentFile, filePath);
});

test('allows authorized security and admin users to access evidence', async () => {
  for (const user of [{ user_id: 'officer-1', role: 'security' }, { user_id: 'admin-1', role: 'admin' }]) {
    const response = makeResponse();
    await incidentController.serveEvidence(requestFor(user), response);
    assert.equal(response.sentFile, filePath);
  }
});

test('returns a safe 404 for nonexistent evidence', async () => {
  const response = makeResponse();
  await incidentController.serveEvidence(requestFor({ user_id: 'student-b', role: 'student' }, 'missing.png'), response);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.payload, { success: false, message: 'Evidence not found' });
});

test('rejects a path traversal attempt', async () => {
  const response = makeResponse();
  await incidentController.serveEvidence(requestFor({ user_id: 'student-b', role: 'student' }, '../backend/server.js'), response);

  assert.equal(response.statusCode, 404);
  assert.equal(response.sentFile, null);
});
