const test = require('node:test');
const assert = require('node:assert/strict');
const { CampusLocation } = require('../src/models');
const {
  attachCampusLocationMatches,
  findNearestCampusLocation
} = require('../src/services/campusLocationMatchingService');
const { CAMPUS_LOCATION_MATCH_RADIUS_METERS } = require('../src/config/locationMatching');

const originalFindAll = CampusLocation.findAll;
const campusCenter = { latitude: 10.9854535, longitude: 39.2631819 };
const latitudeOffsetForMeters = (meters) => meters / 6371000 * (180 / Math.PI);

test.afterEach(() => {
  CampusLocation.findAll = originalFindAll;
});

test('matches an incident inside the radius to its nearest active campus location', () => {
  const location = {
    location_id: 'campus-center',
    name: 'Mekdela Amba University',
    latitude: campusCenter.latitude,
    longitude: campusCenter.longitude,
    is_active: true
  };
  const incidentLatitude = campusCenter.latitude + latitudeOffsetForMeters(30);
  const match = findNearestCampusLocation(incidentLatitude, campusCenter.longitude, [location]);

  assert.equal(CAMPUS_LOCATION_MATCH_RADIUS_METERS, 100);
  assert.equal(match.location.location_id, 'campus-center');
  assert.ok(match.distance_meters < CAMPUS_LOCATION_MATCH_RADIUS_METERS);
});

test('leaves an incident outside the matching radius unmatched', () => {
  const location = {
    location_id: 'campus-center',
    name: 'Mekdela Amba University',
    latitude: campusCenter.latitude,
    longitude: campusCenter.longitude,
    is_active: true
  };
  const incidentLatitude = campusCenter.latitude + latitudeOffsetForMeters(130);

  assert.equal(findNearestCampusLocation(incidentLatitude, campusCenter.longitude, [location]), null);
});

test('selects the nearest location when multiple active locations are within the radius', () => {
  const locations = [
    { location_id: 'administration', name: 'Administration', latitude: 10.984911, longitude: 39.262305, is_active: true },
    { location_id: 'registrar', name: 'Registrar', latitude: 10.984265, longitude: 39.262257, is_active: true }
  ];
  const match = findNearestCampusLocation(10.984265, 39.262257, locations);

  assert.equal(match.location.location_id, 'registrar');
  assert.equal(match.distance_meters, 0);
});

test('ignores inactive campus locations', () => {
  const locations = [{
    location_id: 'inactive-library',
    name: 'Library',
    latitude: campusCenter.latitude,
    longitude: campusCenter.longitude,
    is_active: false
  }];

  assert.equal(findNearestCampusLocation(campusCenter.latitude, campusCenter.longitude, locations), null);
});

test('missing incident coordinates produce no match without querying campus locations', async () => {
  CampusLocation.findAll = async () => {
    throw new Error('location lookup should be skipped');
  };

  const [matchedIncident] = await attachCampusLocationMatches([{ incident_id: 'missing-gps' }]);

  assert.equal(matchedIncident.campus_location_id, null);
  assert.equal(matchedIncident.campus_location, null);
});

test('invalid incident and campus coordinates produce no match without throwing', () => {
  const invalidLocations = [{
    location_id: 'invalid-campus',
    latitude: 91,
    longitude: 'not-a-coordinate',
    is_active: true
  }];

  assert.doesNotThrow(() => {
    assert.equal(findNearestCampusLocation('not-a-coordinate', 39.2, invalidLocations), null);
    assert.equal(findNearestCampusLocation(10.9, 39.2, invalidLocations), null);
  });
});

test('matching metadata does not alter the original incident GPS or location text', async () => {
  CampusLocation.findAll = async () => [{
    location_id: 'campus-center',
    name: 'Mekdela Amba University',
    zone_id: 'verified-zone',
    latitude: campusCenter.latitude,
    longitude: campusCenter.longitude,
    is_active: true
  }];
  const incident = {
    incident_id: 'incident-preserved',
    latitude: String(campusCenter.latitude),
    longitude: String(campusCenter.longitude),
    location_name: 'Near the main path',
    description: 'User-provided incident description',
    type: 'theft',
    severity: 'high'
  };

  const [matchedIncident] = await attachCampusLocationMatches([incident]);

  assert.equal(matchedIncident.campus_location_id, 'campus-center');
  assert.equal(matchedIncident.campus_location.name, 'Mekdela Amba University');
  assert.equal(matchedIncident.latitude, incident.latitude);
  assert.equal(matchedIncident.longitude, incident.longitude);
  assert.equal(matchedIncident.location_name, incident.location_name);
  assert.equal(matchedIncident.description, incident.description);
  assert.equal(matchedIncident.type, incident.type);
  assert.equal(matchedIncident.severity, incident.severity);
});
