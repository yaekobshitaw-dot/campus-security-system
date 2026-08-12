const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/profile', (req, res) => {
  res.json({ success: true, data: req.user });
});

module.exports = router;
