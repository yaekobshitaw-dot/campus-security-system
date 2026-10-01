const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { Response, Incident, User } = require('../models');

router.use(authenticate, authorize('security', 'security_officer', 'admin'));

router.get('/', async (req, res) => {
  try {
    const where = ['security', 'security_officer'].includes(String(req.user.role || '').trim().toLowerCase())
      ? { responder_id: req.user.user_id }
      : {};
    const responses = await Response.findAll({
      where,
      include: [
        { model: Incident, as: 'incident' },
        { model: User, as: 'responder', attributes: ['user_id', 'name', 'role'] }
      ],
      order: [['created_at', 'DESC']]
    });
    return res.json({ success: true, data: responses });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load responses' });
  }
});

module.exports = router;
