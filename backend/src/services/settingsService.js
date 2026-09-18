const { SystemSetting } = require('../models');

const SETTING_DEFINITIONS = [
  { key: 'emergency.sos_cooldown_seconds', category: 'emergency', defaultValue: '30', type: 'integer', min: 5, max: 300 },
  { key: 'emergency.sos_auto_assign_enabled', category: 'emergency', defaultValue: 'true', type: 'boolean' },
  { key: 'notifications.admin_alerts_enabled', category: 'notifications', defaultValue: 'true', type: 'boolean' },
  { key: 'campus.default_latitude', category: 'campus_map', defaultValue: '10.9854535', type: 'latitude' },
  { key: 'campus.default_longitude', category: 'campus_map', defaultValue: '39.2631819', type: 'longitude' },
];

const definitionByKey = new Map(SETTING_DEFINITIONS.map((definition) => [definition.key, definition]));

const ensureDefaultSettings = async () => {
  for (const definition of SETTING_DEFINITIONS) {
    await SystemSetting.findOrCreate({
      where: { key: definition.key },
      defaults: { category: definition.category, value: definition.defaultValue },
    });
  }
};

const getSetting = async (key) => {
  const definition = definitionByKey.get(key);
  if (!definition) return null;
  let setting = null;
  try {
    setting = await SystemSetting.findByPk(key);
  } catch {
    setting = null;
  }
  const value = setting?.value ?? definition.defaultValue;
  if (definition.type === 'integer') return Number(value);
  if (definition.type === 'boolean') return value === true || value === 'true';
  return value;
};

const validateSettingValue = (definition, value) => {
  if (definition.type === 'boolean') {
    if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') throw new Error(`${definition.key} must be boolean`);
    return String(value);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${definition.key} must be numeric`);
  if (definition.type === 'integer' && (!Number.isInteger(number) || number < definition.min || number > definition.max)) throw new Error(`${definition.key} must be an integer from ${definition.min} to ${definition.max}`);
  if (definition.type === 'latitude' && (number < -90 || number > 90)) throw new Error(`${definition.key} must be between -90 and 90`);
  if (definition.type === 'longitude' && (number < -180 || number > 180)) throw new Error(`${definition.key} must be between -180 and 180`);
  return String(number);
};

const listSettings = async () => {
  await ensureDefaultSettings();
  const values = await SystemSetting.findAll({ order: [['category', 'ASC'], ['key', 'ASC']] });
  return values.map((setting) => {
    const definition = definitionByKey.get(setting.key);
    return { key: setting.key, category: setting.category, value: setting.value, type: definition?.type || 'text' };
  });
};

const updateSettings = async (settings, userId) => {
  if (!Array.isArray(settings) || !settings.length) throw new Error('At least one setting is required');
  for (const item of settings) {
    const definition = definitionByKey.get(item.key);
    if (!definition) throw new Error(`Setting ${item.key} is not editable`);
    const value = validateSettingValue(definition, item.value);
    await SystemSetting.update({ value, category: definition.category, updated_by: userId }, { where: { key: definition.key } });
  }
  return listSettings();
};

module.exports = { SETTING_DEFINITIONS, ensureDefaultSettings, getSetting, listSettings, updateSettings };
