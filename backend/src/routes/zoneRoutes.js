const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { Zone } = require('../models');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const zones = await Zone.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
    return res.json({ success: true, data: zones });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load zones' });
  }
});

module.exports = router;
