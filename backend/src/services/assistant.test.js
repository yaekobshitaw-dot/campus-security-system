const test = require('node:test');
const assert = require('node:assert/strict');
const { Alert, Incident, Response, User } = require('../models');
const { buildAuthorizedContext } = require('./assistantAuthorization');
const { buildAssistantPrompt } = require('./assistantPrompt');

const originalMethods = {
  incidentFindAll: Incident.findAll,
  incidentCount: Incident.count,
  responseFindAll: Response.findAll,
  alertFindAll: Alert.findAll,
  incidentCreate: Incident.create,
  incidentUpdate: Incident.update,
  incidentDestroy: Incident.destroy,
  responseCreate: Response.create,
  responseUpdate: Response.update,
  userUpdate: User.update,
  alertCreate: Alert.create,
  alertUpdate: Alert.update,
  alertDestroy: Alert.destroy
};

const record = (value) => ({
  ...value,
  toJSON() {
    return { ...value };
  }
});

const newestOwnedIncident = record({
  incident_id: 'owned-newest',
  user_id: 'owner',
  type: 'suspicious_package',
  severity: 'high',
  status: 'investigating',
  location_name: 'Library',
  created_at: '2026-09-10T10:00:00.000Z',
  description: 'private description',
  latitude: '9.0000000',
  longitude: '38.0000000',
  photos: ['private-photo.jpg'],
  password_hash: 'private-hash',
  push_token: 'private-token'
});
const olderOwnedIncident = record({
  incident_id: 'owned-older',
  user_id: 'owner',
  type: 'theft',
  severity: 'medium',
  status: 'reported',
  location_name: 'Student Center',
  created_at: '2026-09-09T10:00:00.000Z'
});
const otherUserIncident = record({
  incident_id: 'other-user',
  user_id: 'other-user',
  type: 'medical',
  severity: 'critical',
  status: 'reported',
  location_name: 'Private location',
  created_at: '2026-09-10T11:00:00.000Z'
});
const assignedIncident = record({
  incident_id: 'assigned-incident',
  user_id: 'reporter',
  type: 'fire',
  severity: 'critical',
  status: 'dispatched',
  location_name: 'Science Building',
  created_at: '2026-09-10T09:00:00.000Z'
});

const configureReadMocks = ({ empty = false } = {}) => {
  Incident.findAll = async (options = {}) => {
    if (empty) return [];
    if (options.where?.user_id === 'owner') return [newestOwnedIncident, olderOwnedIncident];
    if (options.where?.user_id === 'other-user') return [otherUserIncident];
    if (options.where?.incident_id) return [assignedIncident];
    return [newestOwnedIncident, olderOwnedIncident, otherUserIncident];
  };
  Incident.count = async (options = {}) => {
    if (options.where?.status?.includes?.('resolved')) return 2;
    if (options.where?.status?.includes?.('reported')) return 3;
    return 5;
  };
  Response.findAll = async (options = {}) => {
    if (options.where?.responder_id === 'officer') {
      return [record({ incident_id: 'assigned-incident', status: 'responding', response_time_seconds: 30 })];
    }
    return [];
  };
  Alert.findAll = async () => [record({
    incident_id: 'owned-newest',
    type: 'incident_updated',
    title: 'Status updated',
    message: 'Your incident is being investigated.',
    sent_at: '2026-09-10T10:05:00.000Z'
  })];
};

const mutationGuard = (name) => async () => {
  throw new Error(`Unexpected assistant mutation: ${name}`);
};

test.beforeEach(() => {
  configureReadMocks();
  Incident.create = mutationGuard('Incident.create');
  Incident.update = mutationGuard('Incident.update');
  Incident.destroy = mutationGuard('Incident.destroy');
  Response.create = mutationGuard('Response.create');
  Response.update = mutationGuard('Response.update');
  User.update = mutationGuard('User.update');
  Alert.create = mutationGuard('Alert.create');
  Alert.update = mutationGuard('Alert.update');
  Alert.destroy = mutationGuard('Alert.destroy');
});

test.afterEach(() => {
  Incident.findAll = originalMethods.incidentFindAll;
  Incident.count = originalMethods.incidentCount;
  Response.findAll = originalMethods.responseFindAll;
  Alert.findAll = originalMethods.alertFindAll;
  Incident.create = originalMethods.incidentCreate;
  Incident.update = originalMethods.incidentUpdate;
  Incident.destroy = originalMethods.incidentDestroy;
  Response.create = originalMethods.responseCreate;
  Response.update = originalMethods.responseUpdate;
  User.update = originalMethods.userUpdate;
  Alert.create = originalMethods.alertCreate;
  Alert.update = originalMethods.alertUpdate;
  Alert.destroy = originalMethods.alertDestroy;
});

test('student, faculty, and staff receive their latest owned incident', async () => {
  for (const role of ['student', 'faculty', 'staff']) {
    const context = await buildAuthorizedContext({ user_id: 'owner', role });
    assert.equal(context.authorized_data.latest_incident.incident_id, 'owned-newest');
    assert.equal(context.authorized_data.incidents.length, 2);
  }
});

test('security receives assigned incidents and latest assignment only', async () => {
  const context = await buildAuthorizedContext({ user_id: 'officer', role: 'security' });
  assert.deepEqual(context.authorized_data.assigned_incidents.map((incident) => incident.incident_id), ['assigned-incident']);
  assert.equal(context.authorized_data.latest_assigned_incident.incident_id, 'assigned-incident');
  assert.doesNotMatch(JSON.stringify(context), /other-user|Private location/);
});

test('admin receives aggregate context without changing scope', async () => {
  const context = await buildAuthorizedContext({ user_id: 'admin', role: 'admin' });
  assert.equal(context.authorized_data.incidents.length, 3);
  assert.deepEqual(context.authorized_data.statistics, { total: 5, active: 3, resolved: 2 });
  assert.equal(context.authorized_data.latest_incident.incident_id, 'owned-newest');
});

test('cross-user incidents remain isolated', async () => {
  const context = await buildAuthorizedContext({ user_id: 'owner', role: 'student' });
  const serialized = JSON.stringify(context);
  assert.match(serialized, /owned-newest/);
  assert.doesNotMatch(serialized, /other-user|Private location/);
});

test('projected context excludes sensitive and unapproved model fields', async () => {
  const context = await buildAuthorizedContext({ user_id: 'owner', role: 'student' });
  const serialized = JSON.stringify(context);
  assert.doesNotMatch(serialized, /description|latitude|longitude|photos|password_hash|push_token|token/i);
  assert.match(serialized, /incident_id|type|severity|status|location_name|created_at/);
});

test('generated prompt contains curated project guidance', () => {
  const prompt = buildAssistantPrompt({ role: 'student', authorized_data: { incidents: [] } });
  assert.match(prompt, /Incident reporting is available/);
  assert.match(prompt, /suspicious_package/);
  assert.match(prompt, /severity values are low, medium, high, and critical/);
  assert.match(prompt, /SOS workflow/);
  assert.match(prompt, /avoid touching, opening, or moving/);
  assert.match(prompt, /Reported means/);
  assert.match(prompt, /no stored in_progress status/);
  assert.match(prompt, /Students, faculty, and staff/);
  assert.match(prompt, /strictly read-only/);
});

test('prompt covers SOS, reporting, suspicious-package, and workflow guidance', () => {
  const prompt = buildAssistantPrompt({ role: 'student', authorized_data: {} });
  for (const phrase of ['critical security_threat incident', 'exact screen steps', 'campus security or emergency services', 'Dispatched', 'On Scene', 'Resolved', 'Closed']) {
    assert.match(prompt, new RegExp(phrase.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')));
  }
});

test('missing incident data is explicitly unavailable rather than invented', async () => {
  configureReadMocks({ empty: true });
  const context = await buildAuthorizedContext({ user_id: 'owner', role: 'student' });
  const prompt = buildAssistantPrompt(context);
  assert.equal(context.authorized_data.latest_incident, null);
  assert.match(prompt, /If the authorized context does not contain.*say it is unavailable/);
  assert.doesNotMatch(prompt, /owned-newest|other-user/);
});

test('assistant context construction remains read-only', async () => {
  await buildAuthorizedContext({ user_id: 'owner', role: 'student' });
  await buildAuthorizedContext({ user_id: 'officer', role: 'security' });
  await buildAuthorizedContext({ user_id: 'admin', role: 'admin' });
});
