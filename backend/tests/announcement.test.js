const test = require('node:test');
const assert = require('node:assert/strict');
const { authorize } = require('../src/middleware/auth');
const announcementController = require('../src/controllers/announcementController');
const announcementService = require('../src/services/announcementService');
const { Alert, Announcement, AnnouncementAudience, AnnouncementRead, sequelize } = require('../src/models');

const adminId = '11111111-1111-4111-8111-111111111111';
const studentId = '22222222-2222-4222-8222-222222222222';
const facultyId = '33333333-3333-4333-8333-333333333333';
const securityId = '44444444-4444-4444-8444-444444444444';
const ids = {
  all: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  student: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  faculty: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  security: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  draft: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  unpublished: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  expired: '99999999-9999-4999-8999-999999999999',
  deleted: '88888888-8888-4888-8888-888888888888'
};

const original = {
  transaction: sequelize.transaction,
  announcementFindAll: Announcement.findAll,
  announcementFindOne: Announcement.findOne,
  announcementCreate: Announcement.create,
  audienceFindAll: AnnouncementAudience.findAll,
  audienceBulkCreate: AnnouncementAudience.bulkCreate,
  audienceDestroy: AnnouncementAudience.destroy,
  readFindOrCreate: AnnouncementRead.findOrCreate,
  alertFindAll: Alert.findAll,
  alertCreate: Alert.create
};

let records;
let reads;
let nextId = 0;

const now = new Date('2026-09-10T12:00:00.000Z');
const makeRecord = (id, overrides = {}) => ({
  announcement_id: id,
  title: `Announcement ${id}`,
  content: 'Campus information',
  priority: 'medium',
  status: 'published',
  created_by: adminId,
  updated_by: adminId,
  created_at: '2026-09-10T10:00:00.000Z',
  updated_at: '2026-09-10T10:00:00.000Z',
  published_at: '2026-09-10T10:00:00.000Z',
  expires_at: null,
  deleted_at: null,
  target_roles: ['student', 'faculty', 'staff', 'security', 'admin'],
  ...overrides
});

const cloneRecord = (record, user, admin = false) => {
  const targetRoles = admin ? record.target_roles : record.target_roles.filter((role) => role === user.role);
  const readAt = reads.get(`${record.announcement_id}:${user.user_id}`) || null;
  return {
    ...record,
    audiences: targetRoles.map((role) => ({ role })),
    reads: readAt ? [{ read_at: readAt }] : [],
    toJSON() {
      return {
        ...this,
        audiences: this.audiences,
        reads: this.reads,
        toJSON: undefined
      };
    },
    async update(values) {
      Object.assign(record, values);
      Object.assign(this, record);
      return this;
    }
  };
};

const matchesWhere = (record, where = {}, user) => {
  if (where.announcement_id && where.announcement_id !== record.announcement_id) return false;
  if (where.deleted_at === null && record.deleted_at !== null) return false;
  if (where.status && where.status !== record.status) return false;
  if (where[Symbol.for('sequelize.or')]) return true;
  const includeAudience = user?.role;
  if (includeAudience && !user.isAdmin && !record.target_roles.includes(includeAudience)) return false;
  if (!user?.isAdmin && record.status === 'published' && record.expires_at && new Date(record.expires_at) <= now) return false;
  return true;
};

const configureMocks = () => {
  records = new Map([
    [ids.all, makeRecord(ids.all)],
    [ids.student, makeRecord(ids.student, { target_roles: ['student'] })],
    [ids.faculty, makeRecord(ids.faculty, { target_roles: ['faculty'] })],
    [ids.security, makeRecord(ids.security, { target_roles: ['security'] })],
    [ids.draft, makeRecord(ids.draft, { status: 'draft', target_roles: ['student'] })],
    [ids.unpublished, makeRecord(ids.unpublished, { status: 'unpublished', target_roles: ['student'] })],
    [ids.expired, makeRecord(ids.expired, { expires_at: '2026-09-09T12:00:00.000Z', target_roles: ['student'] })],
    [ids.deleted, makeRecord(ids.deleted, { deleted_at: '2026-09-08T12:00:00.000Z', target_roles: ['student'] })]
  ]);
  reads = new Map();
  nextId = 0;

  sequelize.transaction = async (callback) => callback({ transaction: true });
  Announcement.findOne = async (options = {}) => {
    const user = options.include?.some((include) => include.as === 'audiences' && include.where?.role)
      ? { role: options.include.find((include) => include.as === 'audiences').where.role, user_id: options.include.find((include) => include.as === 'reads')?.where?.user_id, isAdmin: false }
      : { role: 'admin', user_id: adminId, isAdmin: true };
    const record = [...records.values()].find((candidate) => matchesWhere(candidate, options.where, user)
      && (!options.where?.status || candidate.status === options.where.status));
    return record ? cloneRecord(record, user, user.isAdmin) : null;
  };
  Announcement.findAll = async (options = {}) => {
    const audienceInclude = options.include?.find((include) => include.as === 'audiences');
    const readInclude = options.include?.find((include) => include.as === 'reads');
    const user = audienceInclude?.where?.role
      ? { role: audienceInclude.where.role, user_id: readInclude?.where?.user_id, isAdmin: false }
      : { role: 'admin', user_id: adminId, isAdmin: true };
    return [...records.values()]
      .filter((record) => matchesWhere(record, options.where, user))
      .map((record) => cloneRecord(record, user, user.isAdmin));
  };
  Announcement.create = async (values) => {
    const id = `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`;
    const record = makeRecord(id, { ...values, target_roles: [] });
    records.set(id, record);
    return cloneRecord(record, { role: 'admin', user_id: adminId, isAdmin: true }, true);
  };
  AnnouncementAudience.findAll = async (options = {}) => {
    const record = records.get(options.where.announcement_id);
    return (record?.target_roles || []).map((role) => ({ role }));
  };
  AnnouncementAudience.bulkCreate = async (values) => {
    const record = records.get(values[0]?.announcement_id);
    if (record) record.target_roles = values.map((value) => value.role);
    return values;
  };
  AnnouncementAudience.destroy = async (options = {}) => {
    const record = records.get(options.where.announcement_id);
    if (record) record.target_roles = [];
    return 1;
  };
  AnnouncementRead.findOrCreate = async (options = {}) => {
    const key = `${options.where.announcement_id}:${options.where.user_id}`;
    if (!reads.has(key)) reads.set(key, options.defaults.read_at);
    const read = {
      read_at: reads.get(key),
      async update(values) {
        this.read_at = values.read_at;
        reads.set(key, this.read_at);
      }
    };
    return [read, false];
  };
};

const response = () => ({
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

const user = (role, userId = `${role}-user`) => ({ role, user_id: userId });

const call = async (method, req) => {
  const res = response();
  await announcementController[method](req, res);
  return res;
};

test.beforeEach(() => {
  configureMocks();
});

test.afterEach(() => {
  sequelize.transaction = original.transaction;
  Announcement.findAll = original.announcementFindAll;
  Announcement.findOne = original.announcementFindOne;
  Announcement.create = original.announcementCreate;
  AnnouncementAudience.findAll = original.audienceFindAll;
  AnnouncementAudience.bulkCreate = original.audienceBulkCreate;
  AnnouncementAudience.destroy = original.audienceDestroy;
  AnnouncementRead.findOrCreate = original.readFindOrCreate;
  Alert.findAll = original.alertFindAll;
  Alert.create = original.alertCreate;
});

test('admin creates a draft', async () => {
  const result = await call('create', { user: user('admin', adminId), body: { title: 'Draft', content: 'Content', target_roles: ['student'] } });
  assert.equal(result.statusCode, 201);
  assert.equal(result.payload.data.status, 'draft');
});

test('admin edits a draft', async () => {
  const result = await call('update', { user: user('admin', adminId), params: { id: ids.draft }, body: { title: 'Updated draft' } });
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.data.title, 'Updated draft');
});

test('admin publishes an announcement', async () => {
  const result = await call('publish', { user: user('admin', adminId), params: { id: ids.draft }, body: {} });
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.data.status, 'published');
});

test('admin unpublishes an announcement', async () => {
  const result = await call('unpublish', { user: user('admin', adminId), params: { id: ids.all }, body: {} });
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.data.status, 'unpublished');
});

test('admin soft-deletes an announcement', async () => {
  const result = await call('remove', { user: user('admin', adminId), params: { id: ids.all }, body: {} });
  assert.equal(result.statusCode, 200);
  assert.ok(records.get(ids.all).deleted_at);
});

test('non-admin management requests return 403', () => {
  for (const role of ['student', 'faculty', 'staff', 'security']) {
    const res = response();
    let nextCalled = false;
    authorize('admin')({ user: user(role) }, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
  }
});

test('student can see all-campus and student-targeted announcements', async () => {
  const result = await call('list', { user: user('student', studentId) });
  const visible = result.payload.data.map((item) => item.announcement_id);
  assert.ok(visible.includes(ids.all));
  assert.ok(visible.includes(ids.student));
});

test('student cannot see faculty-only announcements', async () => {
  const result = await call('list', { user: user('student', studentId) });
  assert.ok(!result.payload.data.some((item) => item.announcement_id === ids.faculty));
});

test('faculty cannot see student-only announcements', async () => {
  const result = await call('list', { user: user('faculty', facultyId) });
  assert.ok(!result.payload.data.some((item) => item.announcement_id === ids.student));
});

test('security can see security-targeted announcements', async () => {
  const result = await call('list', { user: user('security', securityId) });
  assert.ok(result.payload.data.some((item) => item.announcement_id === ids.security));
});

test('draft, unpublished, expired, and deleted announcements are hidden from non-admin users', async () => {
  const result = await call('list', { user: user('student', studentId) });
  const visible = result.payload.data.map((item) => item.announcement_id);
  assert.ok(!visible.includes(ids.draft));
  assert.ok(!visible.includes(ids.unpublished));
  assert.ok(!visible.includes(ids.expired));
  assert.ok(!visible.includes(ids.deleted));
});

test('admin can inspect non-deleted management records', async () => {
  const result = await call('getById', { user: user('admin', adminId), params: { id: ids.draft }, body: {} });
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.data.status, 'draft');
});

test('user can mark an accessible announcement as read', async () => {
  const result = await call('markRead', { user: user('student', studentId), params: { id: ids.all }, body: {} });
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.data.is_read, true);
});

test('user cannot mark an inaccessible announcement as read', async () => {
  const result = await call('markRead', { user: user('student', studentId), params: { id: ids.faculty }, body: {} });
  assert.equal(result.statusCode, 404);
});

test('read state is isolated per user', async () => {
  await call('markRead', { user: user('student', studentId), params: { id: ids.all }, body: {} });
  const student = await call('getById', { user: user('student', studentId), params: { id: ids.all }, body: {} });
  const faculty = await call('getById', { user: user('faculty', facultyId), params: { id: ids.all }, body: {} });
  assert.equal(student.payload.data.is_read, true);
  assert.equal(faculty.payload.data.is_read, false);
});

test('unread count is correct', async () => {
  await call('markRead', { user: user('student', studentId), params: { id: ids.all }, body: {} });
  const result = await call('unreadCount', { user: user('student', studentId), body: {} });
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.data.count, 1);
});

test('sensitive user fields are never returned', async () => {
  const result = await call('getById', { user: user('student', studentId), params: { id: ids.all }, body: {} });
  const serialized = JSON.stringify(result.payload);
  assert.doesNotMatch(serialized, /password|token|phone|email|latitude|longitude|push_token/i);
  assert.doesNotMatch(serialized, new RegExp(adminId));
});

test('malformed announcement IDs are rejected', async () => {
  const result = await call('getById', { user: user('student', studentId), params: { id: 'not-an-id' }, body: {} });
  assert.equal(result.statusCode, 400);
});

test('published announcements require a valid audience', async () => {
  records.get(ids.draft).target_roles = [];
  const result = await call('publish', { user: user('admin', adminId), params: { id: ids.draft }, body: {} });
  assert.equal(result.statusCode, 400);
});

test('unknown audience roles are rejected', async () => {
  const result = await call('create', { user: user('admin', adminId), body: { title: 'Invalid', content: 'Content', target_roles: ['visitor'] } });
  assert.equal(result.statusCode, 400);
});

test('announcement implementation does not use incident Alert persistence', async () => {
  Alert.findAll = async () => { throw new Error('Alert persistence must not be used'); };
  Alert.create = async () => { throw new Error('Alert persistence must not be used'); };
  const result = await call('list', { user: user('student', studentId) });
  assert.equal(result.statusCode, 200);
});
