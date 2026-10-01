const express = require('express');
const { isSystemActive } = require('../services/settingsService');

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    return res.json({ success: true, data: { active: await isSystemActive() } });
  } catch {
    return res.status(503).json({
      success: false,
      code: 'SYSTEM_STATUS_UNAVAILABLE',
      message: 'System availability could not be verified. Please try again later.'
    });
  }
});

module.exports = router;
