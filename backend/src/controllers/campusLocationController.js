const { CampusLocation } = require('../models');
const { validateCampusLocationPayload } = require('../validators/campusLocationValidator');

const DEFAULT_LOCATIONS = [
  // Keep the original campus center
  { name: 'Mekdela Amba University', type: 'university', latitude: 10.9854535, longitude: 39.2631819, description: 'Verified Tulu Awuliya campus center.' },
  // Existing administration entry should remain unconfigured to preserve admin placement workflow
  { name: 'MAU Administration BD', type: 'administration', description: 'Place this location using the map picker.' },
  // A separate verified Administration marker (does not replace the unconfigured admin placeholder)
  { name: 'Administration', type: 'administration', latitude: 10.984911, longitude: 39.262305, description: 'Administration (verified coordinates).' },
  // Registrar (new or updated if exists)
  { name: 'Registrar', type: 'administration', latitude: 10.984265, longitude: 39.262257, description: 'Registrar (verified coordinates).' },
  // Student class (matches existing 'Student class' record in the project)
  { name: 'Student class', type: 'classroom', latitude: 10.985701, longitude: 39.264714, description: 'Student Class (verified coordinates).' },
  // Seminar building (matches existing Seminar Bld)
  { name: 'Seminar Bld', type: 'seminar', latitude: 10.985145468921166, longitude: 39.26394668831565, description: 'Seminar Building (verified coordinates).' },
  // Football field
  { name: 'Football Field', type: 'sports', latitude: 10.983982, longitude: 39.259313, description: 'Football Field (verified coordinates).' },
  // Student Lunch must remain exactly as provided
  { name: 'Student Lunch', type: 'cafeteria', latitude: 10.985369171863969, longitude: 39.263093184348726, description: 'Student Lunch (verified coordinates).' },
  // Laundry
  { name: 'Laundry', type: 'building/block', latitude: 10.987250, longitude: 39.260814, description: 'Laundry (verified coordinates).' }
];

const fields = ['name', 'type', 'description', 'latitude', 'longitude', 'zone_id', 'is_active'];
const pick = (body = {}) => fields.reduce((result, field) => { if (body[field] !== undefined) result[field] = body[field]; return result; }, {});
const errorResponse = (res, error) => res.status(400).json({ success: false, message: error.message });

async function ensureDefaults() {
  for (const location of DEFAULT_LOCATIONS) {
    // Default descriptions identify records whose administrator-edited names or types have changed.
    let loc = await CampusLocation.findOne({ where: { name: location.name } });
    let renamed = Boolean(loc && loc.name !== location.name);
    if (loc && loc.type !== location.type) renamed = true;
    if (!loc && location.description) {
      loc = await CampusLocation.findOne({
        where: { description: location.description, type: location.type }
      });
      if (!loc) {
        loc = await CampusLocation.findOne({
          where: { description: location.description }
        });
      }
      renamed = Boolean(loc);
    }
    let created = false;
    if (!loc) {
      [loc, created] = await CampusLocation.findOrCreate({ where: { name: location.name }, defaults: location });
    }
    try {
      // If existing record found, update coordinates if they differ from the verified values
      if (!created) {
        const updates = {};
        if (!renamed) {
          // Sequelize Decimal fields may come back as strings; compare numerically where possible
          const existingLat = loc.latitude !== null && loc.latitude !== undefined ? parseFloat(String(loc.latitude)) : null;
          const existingLng = loc.longitude !== null && loc.longitude !== undefined ? parseFloat(String(loc.longitude)) : null;
          if (location.latitude !== undefined && (existingLat === null || existingLat !== Number(location.latitude))) updates.latitude = location.latitude;
          if (location.longitude !== undefined && (existingLng === null || existingLng !== Number(location.longitude))) updates.longitude = location.longitude;
          // Only set type if the existing record has no meaningful type
          if ((!loc.type || loc.type === 'other') && location.type) updates.type = location.type;
          // Update description if missing
          if ((!loc.description || loc.description.trim() === '') && location.description) updates.description = location.description;
        }
        if (Object.keys(updates).length > 0) {
          await loc.update(updates);
        }
      }
    } catch (err) {
      // Non-fatal: log and continue. Controller-level error handling will surface issues.
      console.warn('Could not ensure default campus location', location.name, err.message || err);
    }
  }
}

exports.getLocations = async (req, res) => {
  try {
    await ensureDefaults();
    const locations = await CampusLocation.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
    return res.json({ success: true, data: locations });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load campus locations' });
  }
};

exports.getLocationById = async (req, res) => {
  try {
    const location = await CampusLocation.findOne({ where: { location_id: req.params.id, is_active: true } });
    if (!location) return res.status(404).json({ success: false, message: 'Campus location not found' });
    return res.json({ success: true, data: location });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load campus location' });
  }
};

exports.createLocation = async (req, res) => {
  let values;
  try { values = validateCampusLocationPayload(pick(req.body)); } catch (error) { return errorResponse(res, error); }
  try { return res.status(201).json({ success: true, data: await CampusLocation.create(values) }); }
  catch (error) { return res.status(error.name === 'SequelizeUniqueConstraintError' ? 409 : 500).json({ success: false, message: error.name === 'SequelizeUniqueConstraintError' ? 'A campus location with this name already exists' : 'Unable to create campus location' }); }
};

const updateLocation = async (req, res) => {
  const location = await CampusLocation.findByPk(req.params.id);
  if (!location) return res.status(404).json({ success: false, message: 'Campus location not found' });
  let values;
  try { values = validateCampusLocationPayload({ ...location.toJSON(), ...pick(req.body) }); } catch (error) { return errorResponse(res, error); }
  try {
    await location.update(values);
    const io = req.app.get('io');
    if (io) io.to('role:security').to('role:admin').emit('campus-location-updated', location.toJSON());
    return res.json({ success: true, data: location });
  }
  catch (error) { return res.status(500).json({ success: false, message: 'Unable to update campus location' }); }
};

exports.updateLocation = updateLocation;
exports.patchLocation = updateLocation;
exports.deleteLocation = async (req, res) => {
  try {
    const location = await CampusLocation.findByPk(req.params.id);
    if (!location) return res.status(404).json({ success: false, message: 'Campus location not found' });
    await location.update({ is_active: false });
    return res.json({ success: true, message: 'Campus location deleted successfully' });
  } catch (error) { return res.status(500).json({ success: false, message: 'Unable to delete campus location' }); }
};