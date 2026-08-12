const { body, validationResult } = require('express-validator');

const validateIncident = [
  body('type').notEmpty().withMessage('Incident type is required'),
  body('description').optional().isString(),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('is_anonymous').optional().isBoolean(),
  body('is_sos').optional().isBoolean(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = { validateIncident };
