const test = require('node:test');
const assert = require('node:assert/strict');
const { validateZonePayload } = require('../src/validators/zoneValidator');

const circle = { name: 'North Gate', center_lat: 9.02, center_lng: 38.75, radius: 500 };
const polygon = {
  name: 'Library Area',
  coordinates: {
    type: 'Polygon',
    coordinates: [[
      [38.74, 9.01],
      [38.75, 9.01],
      [38.75, 9.02],
      [38.74, 9.01]
    ]]
  }
};

test('accepts a circle zone', () => {
  const result = validateZonePayload(circle);
  assert.equal(result.radius, 500);
  assert.equal(result.center_lat, 9.02);
});

test('accepts a closed GeoJSON polygon zone', () => {
  const result = validateZonePayload(polygon);
  assert.equal(result.coordinates.type, 'Polygon');
  assert.deepEqual(result.coordinates.coordinates[0][0], [38.74, 9.01]);
});

test('rejects invalid circle coordinates and radius', () => {
  assert.throws(() => validateZonePayload({ ...circle, center_lat: 91 }), /center_lat/);
  assert.throws(() => validateZonePayload({ ...circle, center_lng: -181 }), /center_lng/);
  assert.throws(() => validateZonePayload({ ...circle, radius: 0 }), /positive integer/);
});

test('rejects malformed polygons', () => {
  assert.throws(() => validateZonePayload({ name: 'Open Area', coordinates: { type: 'Polygon', coordinates: [[[38.74, 9.01], [38.75, 9.01], [38.74, 9.01]]] } }), /at least four/);
  assert.throws(() => validateZonePayload({ name: 'Open Area', coordinates: { type: 'Polygon', coordinates: [[[38.74, 9.01], [38.75, 9.01], [38.75, 9.02], [38.74, 9.02]]] } }), /closed/);
});

test('requires either a polygon or complete circle geometry', () => {
  assert.throws(() => validateZonePayload({ name: 'Missing geometry' }), /requires either/);
});
