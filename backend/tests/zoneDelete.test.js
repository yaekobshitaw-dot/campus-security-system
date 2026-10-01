const test = require('node:test');
const assert = require('node:assert/strict');
const controller = require('../src/controllers/zoneController');
const { authorize } = require('../src/middleware/auth');
const { CampusLocation, Zone } = require('../src/models');

const originals = {
  findByPk: Zone.findByPk,
  count: CampusLocation.count,
};

const response = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; },
});

test.afterEach(() => {
  Object.assign(Zone, { findByPk: originals.findByPk });
  Object.assign(CampusLocation, { count: originals.count });
});

test('zone deletion is blocked while campus locations reference the zone', async () => {
  let destroyed = false;
  Zone.findByPk = async () => ({
    zone_id: 'zone-1',
    async destroy() { destroyed = true; },
  });
  CampusLocation.count = async () => 2;
  const res = response();

  await controller.deleteZone({ params: { id: 'zone-1' } }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.payload.message, /campus locations are assigned/);
  assert.equal(destroyed, false);
});

test('zone deletion succeeds when no campus locations reference the zone', async () => {
  let destroyed = false;
  Zone.findByPk = async () => ({
    zone_id: 'zone-1',
    async destroy() { destroyed = true; },
  });
  CampusLocation.count = async () => 0;
  const res = response();

  await controller.deleteZone({ params: { id: 'zone-1' } }, res);

  assert.equal(res.statusCode, null);
  assert.equal(res.payload.success, true);
  assert.equal(destroyed, true);
});

test('zone deletion reports foreign-key dependency errors clearly', async () => {
  Zone.findByPk = async () => ({
    zone_id: 'zone-1',
    async destroy() {
      const error = new Error('foreign key constraint');
      error.name = 'SequelizeForeignKeyConstraintError';
      throw error;
    },
  });
  CampusLocation.count = async () => 0;
  const res = response();

  await controller.deleteZone({ params: { id: 'zone-1' } }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.payload.message, /referenced by other records/);
});

test('security officers are forbidden by the existing admin-only zone authorization', () => {
  const res = response();

  authorize('admin')({ user: { role: 'security_officer' } }, res, () => {
    throw new Error('unexpected authorization');
  });

  assert.equal(res.statusCode, 403);
});
