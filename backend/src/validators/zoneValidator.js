const isFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return false;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const coordinateValue = (value, minimum, maximum, label) => {
  const number = isFiniteNumber(value);
  if (number === false || number === null || number < minimum || number > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`);
  }
  return number;
};

const normalizePolygon = (coordinates) => {
  let polygon = coordinates;
  if (typeof polygon === 'string') {
    try {
      polygon = JSON.parse(polygon);
    } catch (error) {
      throw new Error('coordinates must be valid JSON');
    }
  }

  if (!polygon || polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates) || polygon.coordinates.length === 0) {
    throw new Error('coordinates must be a valid GeoJSON Polygon');
  }

  const normalizedRings = polygon.coordinates.map((ring) => {
    if (!Array.isArray(ring) || ring.length < 4) {
      throw new Error('Polygon rings must contain at least four positions');
    }

    const normalizedRing = ring.map((position) => {
      if (!Array.isArray(position) || position.length < 2) {
        throw new Error('Polygon positions must contain longitude and latitude');
      }
      return [
        coordinateValue(position[0], -180, 180, 'Polygon longitude'),
        coordinateValue(position[1], -90, 90, 'Polygon latitude')
      ];
    });

    const first = normalizedRing[0];
    const last = normalizedRing[normalizedRing.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      throw new Error('Polygon rings must be closed');
    }

    return normalizedRing;
  });

  return { type: 'Polygon', coordinates: normalizedRings };
};

const parseCoordinates = (coordinates) => {
  if (coordinates === null || coordinates === undefined || coordinates === '') return null;
  return normalizePolygon(coordinates);
};

const validateZonePayload = (payload, { partial = false } = {}) => {
  const values = { ...payload };
  if (!partial || values.name !== undefined) {
    if (typeof values.name !== 'string' || !values.name.trim() || values.name.trim().length > 100) {
      throw new Error('name is required and must be 100 characters or fewer');
    }
    values.name = values.name.trim();
  }

  if (values.center_lat !== undefined && values.center_lat !== null && values.center_lat !== '') {
    values.center_lat = coordinateValue(values.center_lat, -90, 90, 'center_lat');
  } else if (values.center_lat !== undefined) {
    values.center_lat = null;
  }

  if (values.center_lng !== undefined && values.center_lng !== null && values.center_lng !== '') {
    values.center_lng = coordinateValue(values.center_lng, -180, 180, 'center_lng');
  } else if (values.center_lng !== undefined) {
    values.center_lng = null;
  }

  if (values.radius !== undefined && values.radius !== null && values.radius !== '') {
    const radius = Number(values.radius);
    if (!Number.isInteger(radius) || radius <= 0) {
      throw new Error('radius must be a positive integer');
    }
    values.radius = radius;
  } else if (values.radius !== undefined) {
    values.radius = null;
  }

  if (values.coordinates !== undefined) {
    values.coordinates = parseCoordinates(values.coordinates);
  }

  if (!partial || values.coordinates !== undefined || values.center_lat !== undefined || values.center_lng !== undefined || values.radius !== undefined) {
    const hasPolygon = values.coordinates !== null && values.coordinates !== undefined;
    const hasCircle = values.center_lat !== null && values.center_lat !== undefined
      && values.center_lng !== null && values.center_lng !== undefined
      && values.radius !== null && values.radius !== undefined;
    if (!hasPolygon && !hasCircle) {
      throw new Error('A zone requires either a GeoJSON Polygon or center_lat, center_lng, and radius');
    }
  }

  return values;
};

module.exports = { normalizePolygon, validateZonePayload };
