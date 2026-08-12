const isEmail = require('../utils/validators').isEmail;

const validateUser = (data) => {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return { error: { details: [{ message: 'Invalid payload' }] } };
  }
  if (data.email && !isEmail(data.email)) {
    errors.push('Valid email is required');
  }
  if (data.phone && typeof data.phone !== 'string') {
    errors.push('Phone must be a string');
  }
  return {
    error: errors.length ? { details: [{ message: errors.join(', ') }] } : null
  };
};

module.exports = { validateUser };
