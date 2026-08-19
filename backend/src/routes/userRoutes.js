const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { User } = require('../models');

router.use(authenticate);

router.get('/profile', (req, res) => {
  res.json({ success: true, data: req.user });
});

router.get('/all', authorize('admin'), async (req, res) => {
  try {
    const users = await User.findAll({
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: users.map((user) => user.toJSON())
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

router.patch('/:userId/status', authorize('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ success: false, message: 'is_active must be a boolean' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await user.update({ is_active });

    return res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      data: user.toJSON()
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
});

module.exports = router;
