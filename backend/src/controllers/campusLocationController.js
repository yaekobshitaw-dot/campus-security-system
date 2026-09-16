const { CampusLocation } = require('../models');
const { validateCampusLocationPayload } = require('../validators/campusLocationValidator');

const DEFAULT_LOCATIONS = [
  { name: 'Mekdela Amba University', type: 'university', latitude: 10.9854535, longitude: 39.2631819, description: 'Verified Tulu Awuliya campus center.' },
  { name: 'MAU Administration BD', type: 'administration', description: 'Place this location using the map picker.' },
  { name: 'Student class', type: 'classroom', description: 'Place this location using the map picker.' },
  { name: 'Seminar Bld', type: 'seminar', description: 'Place this location using the map picker.' },
  { name: 'Fenta Abnew', type: 'other', description: 'Place this location using the map picker.' }
];

const fields = ['name', 'type', 'description', 'latitude', 'longitude', 'is_active'];
const pick = (body = {}) => fields.reduce((result, field) => { if (body[field] !== undefined) result[field] = body[field]; return result; }, {});
const errorResponse = (res, error) => res.status(400).json({ success: false, message: error.message });

async function ensureDefaults() {
  for (const location of DEFAULT_LOCATIONS) {
    await CampusLocation.findOrCreate({ where: { name: location.name }, defaults: location });
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