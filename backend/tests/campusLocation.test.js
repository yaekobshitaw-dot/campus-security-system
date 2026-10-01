const test = require('node:test');
const assert = require('node:assert/strict');
const { authorize } = require('../src/middleware/auth');
const controller = require('../src/controllers/campusLocationController');
const { CampusLocation } = require('../src/models');

test('campus location names use one explicitly named unique index', () => {
  const nameIndexes = CampusLocation.options.indexes.filter((index) => (
    index.unique === true
    && index.fields.length === 1
    && index.fields[0] === 'name'
  ));

  assert.deepEqual(nameIndexes.map((index) => index.name), ['uq_campus_locations_name']);
  assert.equal(CampusLocation.rawAttributes.name.unique, undefined);
});

const original = {
  findOrCreate: CampusLocation.findOrCreate,
  findOne: CampusLocation.findOne,
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
  assert.deepEqual(validator({ name: 'Student Dormitory', type: 'dormitory' }), { name: 'Student Dormitory', type: 'dormitory' });
  assert.throws(() => validator({ name: 'Laundry', type: 'laundry' }), /type must be one of/);
  assert.throws(() => validator({ name: 'Registrar', type: 'registrar' }), /type must be one of/);
  assert.throws(() => validator({ name: 'Building', type: 'building' }), /type must be one of/);
  assert.throws(() => validator({ name: 'Block', type: 'building/block', latitude: 10.98 }), /provided together/);
  assert.throws(() => validator({ name: 'Block', type: 'not-a-category' }), /type must be one of/);
});

test('authorized users can list defaults and unconfigured places are retained', async () => {
  const defaults = [];
  CampusLocation.findOne = async () => null;
  CampusLocation.findOrCreate = async ({ defaults: values }) => { defaults.push(values); return [record(values), true]; };
  CampusLocation.findAll = async () => defaults.map(record);
  const res = response();
  await controller.getLocations({ user: { role: 'student' } }, res);
  assert.equal(res.statusCode, null);
  assert.ok(res.payload.data.some((location) => location.name === 'MAU Administration BD' && location.latitude === undefined));
  assert.ok(res.payload.data.some((location) => location.name === 'Mekdela Amba University' && location.latitude === 10.9854535));
});

test('listing locations does not recreate a default after an administrator renamed it', async () => {
  const renamed = record({
    location_id: 'admin-1',
    name: 'MAU Administration Building',
    type: 'administration',
    latitude: 10.984912,
    longitude: 39.262306,
    description: 'Administration (verified coordinates).',
  });
  const createdDefaults = [];
  CampusLocation.findOne = async ({ where }) => (
    where.description === renamed.description && where.type === renamed.type ? renamed : null
  );
  CampusLocation.findOrCreate = async ({ defaults }) => {
    createdDefaults.push(defaults);
    return [record(defaults), true];
  };
  CampusLocation.findAll = async () => [renamed, ...createdDefaults.map(record)];
  const res = response();

  await controller.getLocations({ user: { role: 'admin' } }, res);

  assert.equal(res.payload.data.filter((location) => location.location_id === 'admin-1').length, 1);
  assert.equal(res.payload.data.find((location) => location.location_id === 'admin-1').name, 'MAU Administration Building');
  assert.equal(renamed.latitude, 10.984912);
  assert.equal(renamed.longitude, 39.262306);
  assert.equal(createdDefaults.some((location) => location.name === 'Administration'), false);
});

test('admin can update coordinates and non-admin cannot manage locations', async () => {
  const location = record({
    location_id: 'location-1',
    name: 'MAU Administration BD',
    type: 'administration',
    latitude: null,
    longitude: null,
    zone_id: 'admin-zone',
  });
  CampusLocation.findByPk = async () => location;
  const res = response();
  await controller.patchLocation({
    params: { id: 'location-1' },
    body: {
      name: 'MAU Administration Building',
      type: 'administration',
      latitude: 10.9854,
      longitude: 39.2631,
      zone_id: 'admin-zone',
    },
    app: { get: () => null },
  }, res);
  assert.equal(res.statusCode, null);
  assert.equal(location.name, 'MAU Administration Building');
  assert.equal(location.type, 'administration');
  assert.equal(location.latitude, 10.9854);
  assert.equal(location.longitude, 39.2631);
  assert.equal(location.zone_id, 'admin-zone');

  const forbidden = response();
  authorize('admin')({ user: { role: 'security' } }, forbidden, () => { throw new Error('unexpected next'); });
  assert.equal(forbidden.statusCode, 403);
});

test('admin can rename a location without changing its type, coordinates, or zone', async () => {
  const location = record({
    location_id: 'location-2',
    name: 'Administration',
    type: 'administration',
    latitude: 10.984911,
    longitude: 39.262305,
    zone_id: 'admin-zone',
  });
  CampusLocation.findByPk = async () => location;
  const res = response();

  await controller.patchLocation({
    params: { id: 'location-2' },
    body: { name: 'MAU Administration Building' },
    app: { get: () => null },
  }, res);

  assert.equal(res.statusCode, null);
  assert.equal(location.name, 'MAU Administration Building');
  assert.equal(location.type, 'administration');
  assert.equal(location.latitude, 10.984911);
  assert.equal(location.longitude, 39.262305);
  assert.equal(location.zone_id, 'admin-zone');
});

test('admin can change a location type without changing its name, coordinates, or zone', async () => {
  const location = record({
    location_id: 'location-3',
    name: 'Administration',
    type: 'administration',
    latitude: 10.984911,
    longitude: 39.262305,
    zone_id: 'admin-zone',
  });
  CampusLocation.findByPk = async () => location;
  const res = response();

  await controller.patchLocation({
    params: { id: 'location-3' },
    body: { type: 'dormitory' },
    app: { get: () => null },
  }, res);

  assert.equal(res.statusCode, null);
  assert.equal(location.name, 'Administration');
  assert.equal(location.type, 'dormitory');
  assert.equal(location.latitude, 10.984911);
  assert.equal(location.longitude, 39.262305);
  assert.equal(location.zone_id, 'admin-zone');
});

test('listing locations preserves an administrator-selected type and coordinates', async () => {
  const changed = record({
    location_id: 'admin-1',
    name: 'Administration',
    type: 'dormitory',
    latitude: 10.984912,
    longitude: 39.262306,
    description: 'Administration (verified coordinates).',
  });
  const createdDefaults = [];
  CampusLocation.findOne = async ({ where }) => where.name === changed.name ? changed : null;
  CampusLocation.findOrCreate = async ({ defaults }) => {
    createdDefaults.push(defaults);
    return [record(defaults), true];
  };
  CampusLocation.findAll = async () => [changed, ...createdDefaults.map(record)];
  const res = response();

  await controller.getLocations({ user: { role: 'admin' } }, res);

  assert.equal(changed.type, 'dormitory');
  assert.equal(changed.latitude, 10.984912);
  assert.equal(changed.longitude, 39.262306);
});

test('admin create rejects partial coordinates', async () => {
  const res = response();
  await controller.createLocation({ body: { name: 'New building', type: 'building/block', latitude: 10.98 } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /provided together/);
});

test('admin can create a named campus location with map coordinates', async () => {
  let createdValues;
  const created = record({
    location_id: 'library-1',
    name: 'Main Library',
    type: 'library',
    description: 'Main campus library',
    latitude: 10.985,
    longitude: 39.263,
    zone_id: null,
  });
  CampusLocation.create = async (values) => {
    createdValues = values;
    return created;
  };
  const res = response();

  await controller.createLocation({
    body: {
      name: ' Main Library ',
      type: 'library',
      description: 'Main campus library',
      latitude: 10.985,
      longitude: 39.263,
    },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdValues.name, 'Main Library');
  assert.equal(createdValues.latitude, 10.985);
  assert.equal(createdValues.longitude, 39.263);
  assert.equal(res.payload.data.name, 'Main Library');
});

test('admin create rejects an empty campus location name', async () => {
  const res = response();

  await controller.createLocation({
    body: { name: '   ', type: 'library', latitude: 10.985, longitude: 39.263 },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /name is required/);
});
