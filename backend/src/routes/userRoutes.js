const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { User } = require('../models');

router.use(authenticate);

router.get('/profile', (req, res) => {
  res.json({ success: true, data: req.user });
});

router.get('/security-officers', authorize('security', 'admin'), async (req, res) => {
  try {
    const officers = await User.findAll({
      where: { role: 'security', is_active: true },
      attributes: ['user_id', 'name', 'role', 'latitude', 'longitude', 'availability_status']
    });
    return res.status(200).json({ success: true, data: officers });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch security officers' });
  }
});

router.patch('/me/location', async (req, res) => {
  if (req.user.role !== 'security') {
    return res.status(403).json({ success: false, message: 'Only security officers can update location' });
  }
  const { latitude, longitude, availability_status: availabilityStatus } = req.body || {};
  const validCoordinate = (value, minimum, maximum) => value !== null && value !== undefined
    && Number.isFinite(Number(value)) && Number(value) >= minimum && Number(value) <= maximum;
  const validStatuses = ['available', 'responding', 'busy', 'offline'];
  if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) {
    return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required' });
  }
  if (availabilityStatus !== undefined && !validStatuses.includes(availabilityStatus)) {
    return res.status(400).json({ success: false, message: 'Invalid availability status' });
  }
  await req.user.update({ latitude, longitude, ...(availabilityStatus ? { availability_status: availabilityStatus } : {}) });
  return res.status(200).json({ success: true, data: req.user.toJSON() });
});

router.put('/push-token', async (req, res) => {
  const { push_token: pushToken } = req.body;
  if (!pushToken || typeof pushToken !== 'string' || pushToken.length > 255) {
    return res.status(400).json({ success: false, message: 'A valid push token is required' });
  }

  await req.user.update({ push_token: pushToken });
  return res.status(204).send();
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
