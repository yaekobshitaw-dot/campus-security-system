const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ success: true, message: 'Alert routes are available.' });
});

router.post('/', (req, res) => {
  res.status(501).json({ success: false, message: 'Create alert not implemented.' });
});

module.exports = router;
