const test = require('node:test');
const assert = require('node:assert/strict');
const { authorize } = require('../src/middleware/auth');
const controller = require('../src/controllers/campusLocationController');
const { CampusLocation } = require('../src/models');

const original = {
  findOrCreate: CampusLocation.findOrCreate,
  findAll: CampusLocation.findAll,
  findByPk: CampusLocation.findByPk,
  create: CampusLocation.create,
};

const response = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; },
});
const record = (values) => ({ ...values, toJSON() { return { ...this }; }, async update(next) { Object.assign(this, next); return this; } });

test.afterEach(() => {
  Object.assign(CampusLocation, original);
});

test('location categories and coordinates validate without guessing', () => {
  const validator = require('../src/validators/campusLocationValidator').validateCampusLocationPayload;
  assert.deepEqual(validator({ name: 'Student class', type: 'classroom' }), { name: 'Student class', type: 'classroom' });
  assert.throws(() => validator({ name: 'Block', type: 'building/block', latitude: 10.98 }), /provided together/);
  assert.throws(() => validator({ name: 'Block', type: 'not-a-category' }), /type must be one of/);
});

test('authorized users can list defaults and unconfigured places are retained', async () => {
  const defaults = [];
  CampusLocation.findOrCreate = async ({ defaults: values }) => { defaults.push(values); return [record(values), true]; };
  CampusLocation.findAll = async () => defaults.map(record);
  const res = response();
  await controller.getLocations({ user: { role: 'student' } }, res);
  assert.equal(res.statusCode, null);
  assert.ok(res.payload.data.some((location) => location.name === 'MAU Administration BD' && location.latitude === undefined));
  assert.ok(res.payload.data.some((location) => location.name === 'Mekdela Amba University' && location.latitude === 10.9854535));
});

test('admin can update coordinates and non-admin cannot manage locations', async () => {
  const location = record({ location_id: 'location-1', name: 'MAU Administration BD', type: 'administration', latitude: null, longitude: null });
  CampusLocation.findByPk = async () => location;
  const res = response();
  await controller.patchLocation({ params: { id: 'location-1' }, body: { latitude: 10.9854, longitude: 39.2631 }, app: { get: () => null } }, res);
  assert.equal(res.statusCode, null);
  assert.equal(location.latitude, 10.9854);
  assert.equal(location.longitude, 39.2631);

  const forbidden = response();
  authorize('admin')({ user: { role: 'security' } }, forbidden, () => { throw new Error('unexpected next'); });
  assert.equal(forbidden.statusCode, 403);
});

test('admin create rejects partial coordinates', async () => {
  const res = response();
  await controller.createLocation({ body: { name: 'New building', type: 'building/block', latitude: 10.98 } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /provided together/);
});
