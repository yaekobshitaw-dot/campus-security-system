const coordinateValue = (value, minimum, maximum) => {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
    ? coordinate
    : null;
};

const coordinatesFor = (latitude, longitude) => {
  const lat = coordinateValue(latitude, -90, 90);
  const lng = coordinateValue(longitude, -180, 180);
  return lat === null || lng === null ? null : { latitude: lat, longitude: lng };
};

const haversineDistanceMeters = (latitude1, longitude1, latitude2, longitude2) => {
  const earthRadiusMeters = 6371000;
  const radians = (degrees) => degrees * Math.PI / 180;
  const deltaLatitude = radians(latitude2 - latitude1);
  const deltaLongitude = radians(longitude2 - longitude1);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2)) * Math.sin(deltaLongitude / 2) ** 2;
  const boundedA = Math.min(1, Math.max(0, a));
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(boundedA), Math.sqrt(1 - boundedA));
};

module.exports = { coordinatesFor, haversineDistanceMeters };
