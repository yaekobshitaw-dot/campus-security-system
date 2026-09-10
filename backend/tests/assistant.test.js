const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'assistant-test-jwt-secret';
const assistantController = require('../src/controllers/assistantController');
const { buildAuthorizedContext } = require('../src/services/assistantAuthorization');
const { buildAssistantPrompt } = require('../src/services/assistantPrompt');
const { fallbackMessage } = require('../src/services/assistantService');
const { authenticate, authorize } = require('../src/middleware/auth');
const { Alert, Incident, Response } = require('../src/models');

const originalIncidentFindAll = Incident.findAll;
const originalIncidentCount = Incident.count;
const originalAlertFindAll = Alert.findAll;
const originalResponseFindAll = Response.findAll;
const originalAxiosPost = axios.post;

const makeResponse = () => ({
  statusCode: null,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return payload;
  }
});

const record = (value) => ({ ...value, toJSON() { return { ...value }; } });
const studentIncident = record({
  incident_id: 'incident-a',
  user_id: 'student-a',
  type: 'theft',
  severity: 'medium',
  status: 'investigating',
  location_name: 'Library',
  created_at: '2026-09-09T10:00:00.000Z'
});
const privateIncident = record({
  incident_id: 'incident-b',
  user_id: 'student-b',
  type: 'medical',
  severity: 'critical',
  status: 'reported',
  location_name: 'Private location',
  created_at: '2026-09-09T11:00:00.000Z'
});

const configureReadMocks = () => {
  Incident.findAll = async (options = {}) => {
    if (options.where?.user_id === 'student-a') return [studentIncident];
    if (options.where?.incident_id) return [studentIncident];
    return [studentIncident, privateIncident];
  };
  Incident.count = async () => 3;
  Response.findAll = async () => [];
  Alert.findAll = async () => [record({ incident_id: 'incident-a', type: 'incident_updated', title: 'Status updated', message: 'Your incident is being investigated.' })];
};

test.beforeEach(() => {
  configureReadMocks();
  process.env.OLLAMA_MODEL = 'qwen2.5-coder:3b';
  axios.post = async () => ({ data: { message: { content: 'Safe assistant answer.' } } });
});

test.afterEach(() => {
  Incident.findAll = originalIncidentFindAll;
  Incident.count = originalIncidentCount;
  Alert.findAll = originalAlertFindAll;
  Response.findAll = originalResponseFindAll;
  axios.post = originalAxiosPost;
  delete process.env.OLLAMA_MODEL;
});

test('rejects an unauthenticated assistant request', () => {
  const response = makeResponse();
  authenticate({ headers: {} }, response, () => { throw new Error('Unauthenticated request was allowed'); });

  assert.equal(response.statusCode, 401);
});

test('allows every supported authenticated role', async () => {
  for (const role of ['student', 'faculty', 'staff', 'security', 'admin']) {
    const response = makeResponse();
    await assistantController.chat({ body: { message: 'How do I report an incident?' }, user: { user_id: `${role}-1`, role } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.success, true);
    assert.equal(response.payload.source, 'ollama');
  }
});

test('rejects missing, empty, and oversized messages', async () => {
  for (const message of [undefined, '', ' '.repeat(2001)]) {
    const response = makeResponse();
    await assistantController.chat({ body: { message }, user: { user_id: 'student-a', role: 'student' } }, response);
    assert.equal(response.statusCode, 400);
  }
});

test('student context is filtered to the authenticated student', async () => {
  const context = await buildAuthorizedContext({ user_id: 'student-a', role: 'student' });
  const prompt = buildAssistantPrompt(context);

  assert.deepEqual(context.authorized_data.incidents.map((incident) => incident.incident_id), ['incident-a']);
  assert.doesNotMatch(prompt, /incident-b|Private location|student-b/);
});

test('security context contains assigned incidents only and omits reporter identity', async () => {
  Response.findAll = async () => [record({ incident_id: 'incident-a', status: 'responding', response_time_seconds: 30 })];
  const context = await buildAuthorizedContext({ user_id: 'officer-1', role: 'security' });
  const prompt = buildAssistantPrompt(context);

  assert.equal(context.authorized_data.assigned_incidents.length, 1);
  assert.equal(context.authorized_data.assigned_incidents[0].response.status, 'responding');
  assert.doesNotMatch(prompt, /student-a|password_hash|push_token/);
});

test('assistant context and prompt exclude secrets', async () => {
  const context = await buildAuthorizedContext({ user_id: 'student-a', role: 'student' });
  const prompt = buildAssistantPrompt(context);

  assert.doesNotMatch(JSON.stringify(context.authorized_data), /password|jwt|token|secret|credential|database/i);
});

test('rejects unsupported roles through existing authorization', () => {
  const response = makeResponse();
  let nextCalled = false;
  authorize('student', 'faculty', 'staff', 'security', 'admin')({ user: { role: 'guest' } }, response, () => { nextCalled = true; });

  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('returns a safe fallback when Ollama is unavailable', async () => {
  axios.post = async () => { throw new Error('connection refused'); };
  const response = makeResponse();
  await assistantController.chat({ body: { message: 'What does In Progress mean?' }, user: { user_id: 'student-a', role: 'student' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.source, 'fallback');
  assert.equal(response.payload.message, fallbackMessage);
});
