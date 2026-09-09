const { Zone } = require('../models');
const { validateZonePayload } = require('../validators/zoneValidator');

const zoneFields = [
  'name',
  'description',
  'coordinates',
  'center_lat',
  'center_lng',
  'radius',
  'security_contact',
  'is_active'
];

const pickZoneFields = (body = {}) => zoneFields.reduce((values, field) => {
  if (body[field] !== undefined) values[field] = body[field];
  return values;
}, {});

const sendValidationError = (res, error) => res.status(400).json({ success: false, message: error.message });
const sendServerError = (res, message, error) => {
  if (error?.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ success: false, message: 'A zone with this name already exists' });
  }
  if (error?.name === 'SequelizeValidationError') {
    return res.status(400).json({ success: false, message: error.message });
  }
  return res.status(500).json({ success: false, message });
};

exports.getZones = async (req, res) => {
  try {
    const zones = await Zone.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
    return res.json({ success: true, data: zones });
  } catch (error) {
    return sendServerError(res, 'Unable to load zones', error);
  }
};

exports.getZoneById = async (req, res) => {
  try {
    const zone = await Zone.findOne({ where: { zone_id: req.params.id, is_active: true } });
    if (!zone) return res.status(404).json({ success: false, message: 'Zone not found' });
    return res.json({ success: true, data: zone });
  } catch (error) {
    return sendServerError(res, 'Unable to load zone', error);
  }
};

exports.createZone = async (req, res) => {
  let values;
  try {
    values = validateZonePayload(pickZoneFields(req.body));
  } catch (error) {
    return sendValidationError(res, error);
  }

  try {
    const zone = await Zone.create(values);
    return res.status(201).json({ success: true, message: 'Zone created successfully', data: zone });
  } catch (error) {
    return sendServerError(res, 'Unable to create zone', error);
  }
};

const updateZone = async (req, res) => {
  let zone;
  try {
    zone = await Zone.findByPk(req.params.id);
  } catch (error) {
    return sendServerError(res, 'Unable to load zone', error);
  }
  if (!zone) return res.status(404).json({ success: false, message: 'Zone not found' });

  let values;
  try {
    values = validateZonePayload({ ...zone.toJSON(), ...pickZoneFields(req.body) });
  } catch (error) {
    return sendValidationError(res, error);
  }

  try {
    await zone.update(values);
    return res.json({ success: true, message: 'Zone updated successfully', data: zone });
  } catch (error) {
    return sendServerError(res, 'Unable to update zone', error);
  }
};

exports.updateZone = updateZone;
exports.patchZone = updateZone;

exports.deleteZone = async (req, res) => {
  try {
    const zone = await Zone.findByPk(req.params.id);
    if (!zone) return res.status(404).json({ success: false, message: 'Zone not found' });
    await zone.destroy();
    return res.json({ success: true, message: 'Zone deleted successfully' });
  } catch (error) {
    return sendServerError(res, 'Unable to delete zone', error);
  }
};
