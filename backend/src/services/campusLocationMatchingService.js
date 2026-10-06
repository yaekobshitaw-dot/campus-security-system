const { CampusLocation } = require('../models');
const { CAMPUS_LOCATION_MATCH_RADIUS_METERS } = require('../config/locationMatching');
const { coordinatesFor, haversineDistanceMeters } = require('../utils/geoUtils');

const isActiveCampusLocation = (location) => (
  location?.is_active === true
  || location?.is_active === 1
  || location?.is_active === '1'
  || location?.is_active === 'true'
);

const findNearestCampusLocation = (
  latitude,
  longitude,
  campusLocations,
  radiusMeters = CAMPUS_LOCATION_MATCH_RADIUS_METERS
) => {
  const incidentCoordinates = coordinatesFor(latitude, longitude);
  if (!incidentCoordinates) return null;

  let nearestMatch = null;
  for (const location of Array.isArray(campusLocations) ? campusLocations : []) {
    if (!isActiveCampusLocation(location)) continue;
    const locationCoordinates = coordinatesFor(location.latitude, location.longitude);
    if (!locationCoordinates) continue;

    const distanceMeters = haversineDistanceMeters(
      incidentCoordinates.latitude,
      incidentCoordinates.longitude,
      locationCoordinates.latitude,
      locationCoordinates.longitude
    );
    if (!nearestMatch || distanceMeters < nearestMatch.distance_meters) {
      nearestMatch = { location, distance_meters: distanceMeters };
    }
  }

  if (!nearestMatch || nearestMatch.distance_meters > radiusMeters) return null;
  return nearestMatch;
};

const toPlainObject = (incident) => (
  typeof incident?.toJSON === 'function' ? incident.toJSON() : { ...incident }
);

const attachCampusLocationMatches = async (incidents) => {
  const incidentList = Array.isArray(incidents) ? incidents : [incidents];
  const needsLocationLookup = incidentList.some((incident) => coordinatesFor(incident?.latitude, incident?.longitude));
  const campusLocations = needsLocationLookup
    ? await CampusLocation.findAll({
      where: { is_active: true },
      attributes: ['location_id', 'name', 'zone_id', 'latitude', 'longitude', 'is_active']
    })
    : [];

  return incidentList.map((incident) => {
    const plainIncident = toPlainObject(incident);
    const match = findNearestCampusLocation(
      plainIncident.latitude,
      plainIncident.longitude,
      campusLocations
    );
    const campusLocation = match
      ? {
        location_id: match.location.location_id,
        name: match.location.name,
        zone_id: match.location.zone_id,
        distance_meters: match.distance_meters
      }
      : null;

    return {
      ...plainIncident,
      campus_location_id: campusLocation?.location_id ?? null,
      campus_location: campusLocation
    };
  });
};

module.exports = {
  attachCampusLocationMatches,
  findNearestCampusLocation
};
