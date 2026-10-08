const test = require('node:test');
const assert = require('node:assert/strict');

process.env.CAMPUS_LOCATION_MATCH_RADIUS_METERS = '250';

const {
    findNearestCampusLocation
} = require('../src/services/campusLocationMatchingService');
const { CAMPUS_LOCATION_MATCH_RADIUS_METERS } = require('../src/config/locationMatching');

const productionIncident = {
    latitude: '10.98731300',
    longitude: '39.26320810'
};
const campusCenter = { latitude: 10.9854535, longitude: 39.2631819 };

test('matches the production GPS incident with a configured 250 meter radius', () => {
    assert.equal(CAMPUS_LOCATION_MATCH_RADIUS_METERS, 250);

    for (const activeValue of[true, 1, '1', 'true']) {
        const match = findNearestCampusLocation(
            productionIncident.latitude,
            productionIncident.longitude, [{
                location_id: 'mekdela-amba-university',
                name: 'Mekdela Amba University',
                latitude: '10.9854535',
                longitude: '39.2631819',
                is_active: activeValue
            }]
        );

        assert.equal(match.location.location_id, 'mekdela-amba-university');
        assert.ok(match.distance_meters > 200 && match.distance_meters < 215);
        assert.ok(match.distance_meters <= CAMPUS_LOCATION_MATCH_RADIUS_METERS);
    }
});

test('selects a nearby active Library over the university when both locations are available', () => {
    const library = {
        location_id: 'library-location',
        name: 'Library',
        latitude: campusCenter.latitude + 0.001,
        longitude: campusCenter.longitude,
        is_active: 'true'
    };
    const university = {
        location_id: 'university-location',
        name: 'Mekdela Amba University',
        latitude: campusCenter.latitude,
        longitude: campusCenter.longitude,
        is_active: true
    };
    const match = findNearestCampusLocation(
        library.latitude,
        library.longitude, [university, library]
    );

    assert.equal(match.location.location_id, 'library-location');
    assert.ok(match.distance_meters < CAMPUS_LOCATION_MATCH_RADIUS_METERS);
});