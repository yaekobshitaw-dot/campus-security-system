const LOCATION_TYPES = [
  'university', 'administration', 'classroom', 'seminar', 'building/block', 'gate',
  'security_post', 'dormitory', 'library', 'clinic', 'cafeteria', 'parking',
  'sports', 'emergency_point', 'other'
];

const coordinate = (value, min, max, label) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${label} must be between ${min} and ${max}`);
  return number;
};

const validateCampusLocationPayload = (payload = {}, { partial = false } = {}) => {
  const values = { ...payload };
  if (!partial || values.name !== undefined) {
    if (typeof values.name !== 'string' || !values.name.trim() || values.name.trim().length > 150) throw new Error('name is required and must be 150 characters or fewer');
    values.name = values.name.trim();
  }
  if (!partial || values.type !== undefined) {
    if (!LOCATION_TYPES.includes(values.type)) throw new Error(`type must be one of: ${LOCATION_TYPES.join(', ')}`);
  }
  if (values.latitude !== undefined) values.latitude = coordinate(values.latitude, -90, 90, 'latitude');
  if (values.longitude !== undefined) values.longitude = coordinate(values.longitude, -180, 180, 'longitude');
  const hasLatitude = values.latitude !== undefined && values.latitude !== null;
  const hasLongitude = values.longitude !== undefined && values.longitude !== null;
  if (hasLatitude !== hasLongitude) throw new Error('latitude and longitude must be provided together');
  if (values.description !== undefined && values.description !== null && typeof values.description !== 'string') throw new Error('description must be a string');
  return values;
};

module.exports = { LOCATION_TYPES, validateCampusLocationPayload };