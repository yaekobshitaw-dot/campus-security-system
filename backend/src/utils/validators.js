const isEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isPhoneNumber = (value) => typeof value === 'string' && /^[0-9+\s-()]{7,20}$/.test(value);
const isUUID = (value) => typeof value === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);

const validateObject = (data, checks) => {
  const errors = [];
  Object.entries(checks).forEach(([key, validator]) => {
    const value = data[key];
    if (!validator(value)) {
      errors.push({ key, value, message: `${key} is invalid` });
    }
  });
  return errors;
};

module.exports = {
  isEmail,
  isPhoneNumber,
  isUUID,
  validateObject
};
