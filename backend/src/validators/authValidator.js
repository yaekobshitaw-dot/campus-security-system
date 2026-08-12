const isEmail = require('../utils/validators').isEmail;

const validateRegister = (data) => {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return { error: { details: [{ message: 'Invalid payload' }] } };
  }
  if (!data.email || !isEmail(data.email)) {
    errors.push('Valid email is required');
  }
  if (!data.password || data.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Name is required');
  }
  return {
    error: errors.length ? { details: [{ message: errors.join(', ') }] } : null
  };
};

const validateLogin = (data) => {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return { error: { details: [{ message: 'Invalid payload' }] } };
  }
  if (!data.email || !isEmail(data.email)) {
    errors.push('Valid email is required');
  }
  if (!data.password || data.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  return {
    error: errors.length ? { details: [{ message: errors.join(', ') }] } : null
  };
};

module.exports = {
  validateRegister,
  validateLogin
};
