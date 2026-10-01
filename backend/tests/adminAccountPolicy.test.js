const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const authController = require('../src/controllers/authController');
const { User } = require('../src/models');
const {
  MAX_ADMIN_ACCOUNTS,
  withAdminAccountsLocked,
  assertAdminCapacity,
  assertUsableAdminRemains
} = require('../src/services/adminAccountPolicy');

const originalTransaction = User.sequelize.transaction;
const originalFindAll = User.findAll;
const originalFindOne = User.findOne;
const originalCreate = User.create;

const response = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; }
});

test.afterEach(() => {
  User.sequelize.transaction = originalTransaction;
  User.findAll = originalFindAll;
  User.findOne = originalFindOne;
  User.create = originalCreate;
});

test('admin account cap allows up to three accounts and rejects a fourth', () => {
  assert.equal(MAX_ADMIN_ACCOUNTS, 3);
  assert.doesNotThrow(() => assertAdminCapacity([{ user_id: 'a1' }, { user_id: 'a2' }]));
  assert.throws(
    () => assertAdminCapacity([{ user_id: 'a1' }, { user_id: 'a2' }, { user_id: 'a3' }]),
    { statusCode: 409, message: 'The maximum number of Admin accounts is 3.' }
  );
  assert.doesNotThrow(() => assertAdminCapacity([{ user_id: 'a1' }, { user_id: 'a2' }, { user_id: 'a3' }], true));
});

test('an active Admin cannot be demoted, deactivated, or deleted when they are the last usable Admin', () => {
  const admins = [{ user_id: 'admin-1', role: 'admin', is_active: true }];

  assert.doesNotThrow(() => assertUsableAdminRemains(admins, 'admin-1', { name: 'Updated name' }));
  assert.throws(() => assertUsableAdminRemains(admins, 'admin-1', { role: 'student' }), /At least one active Admin account must remain/);
  assert.throws(() => assertUsableAdminRemains(admins, 'admin-1', { is_active: false }), /At least one active Admin account must remain/);
  assert.throws(() => assertUsableAdminRemains(admins, 'admin-1', { role: 'deleted' }), /At least one active Admin account must remain/);
});

test('locked admin mutations use a transaction and an update lock', async (context) => {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  let queryOptions;
  User.sequelize.transaction = async (callback) => callback(transaction);
  User.findAll = async (options) => {
    queryOptions = options;
    return [{ user_id: 'admin-1', role: 'admin', is_active: true }];
  };
  context.after(() => {
    User.sequelize.transaction = originalTransaction;
    User.findAll = originalFindAll;
  });

  const result = await withAdminAccountsLocked((activeTransaction, admins) => ({
    activeTransaction,
    adminCount: admins.length
  }));

  assert.equal(result.activeTransaction, transaction);
  assert.equal(result.adminCount, 1);
  assert.equal(queryOptions.where.role, 'admin');
  assert.equal(queryOptions.transaction, transaction);
  assert.equal(queryOptions.lock, 'UPDATE');
});

test('admin creation endpoint rejects a fourth Admin before inserting the account', async () => {
  User.sequelize.transaction = async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } });
  User.findAll = async () => [1, 2, 3].map((number) => ({ user_id: `admin-${number}`, role: 'admin', is_active: true }));
  User.findOne = async () => null;
  let createCalled = false;
  User.create = async () => { createCalled = true; };
  const result = response();

  await authController.createUserByAdmin({
    body: {
      name: 'Fourth Admin',
      email: 'fourth.admin@example.com',
      password: 'StrongPass123',
      role: 'admin'
    }
  }, result);

  assert.equal(result.statusCode, 409);
  assert.equal(result.payload.message, 'The maximum number of Admin accounts is 3.');
  assert.equal(createCalled, false);
});
