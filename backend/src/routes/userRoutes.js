const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { Incident, Response, User } = require('../models');

const LOCATION_STALE_AFTER_MS = 2 * 60 * 1000;
const isValidCoordinate = (value, minimum, maximum) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value))
  && Number(value) >= minimum && Number(value) <= maximum;

router.use(authenticate);

router.get('/profile', (req, res) => {
  res.json({ success: true, data: req.user });
});

router.get('/security-officers', authorize('security', 'admin'), async (req, res) => {
  try {
    const officers = await User.findAll({
      where: { role: 'security', is_active: true },
      attributes: ['user_id', 'name', 'role', 'latitude', 'longitude', 'availability_status', 'location_updated_at']
    });
    const activeResponses = await Response.findAll({
      where: { status: ['assigned', 'responding'] },
      attributes: ['responder_id'],
      include: [{
        model: Incident,
        as: 'incident',
        attributes: ['incident_id', 'status'],
        where: { status: ['reported', 'investigating', 'dispatched', 'on_scene'] }
      }]
    });
    const respondingOfficerIds = new Set(activeResponses.map((response) => response.responder_id));
    const now = Date.now();
    const data = officers.map((officer) => {
      const hasValidLocation = isValidCoordinate(officer.latitude, -90, 90)
        && isValidCoordinate(officer.longitude, -180, 180);
      const locationUpdatedAt = officer.location_updated_at ? new Date(officer.location_updated_at).getTime() : NaN;
      const hasFreshLocation = hasValidLocation && Number.isFinite(locationUpdatedAt)
        && locationUpdatedAt <= now && now - locationUpdatedAt <= LOCATION_STALE_AFTER_MS;
      const isResponding = respondingOfficerIds.has(officer.user_id);
      const availabilityStatus = isResponding
        ? 'responding'
        : hasFreshLocation && ['available', 'busy'].includes(officer.availability_status)
          ? officer.availability_status
          : 'offline';
      const isLiveLocation = hasFreshLocation && availabilityStatus !== 'offline';

      return {
        ...officer.toJSON(),
        availability_status: availabilityStatus,
        location_status: !hasValidLocation ? 'unavailable' : isLiveLocation ? 'live' : 'last_known',
        location_is_stale: hasValidLocation && !isLiveLocation
      };
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch security officers' });
  }
});

router.patch('/me/location', authorize('security', 'admin'), async (req, res) => {
  const { latitude, longitude, availability_status: availabilityStatus } = req.body || {};
  const validCoordinate = (value, minimum, maximum) => value !== null && value !== undefined
    && Number.isFinite(Number(value)) && Number(value) >= minimum && Number(value) <= maximum;
  const validStatuses = ['available', 'responding', 'busy', 'offline'];
  const isOffline = availabilityStatus === 'offline' && latitude == null && longitude == null;
  const hasCoordinates = latitude !== undefined || longitude !== undefined;
  if (hasCoordinates && !isOffline && (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180))) {
    return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required' });
  }
  if (availabilityStatus !== undefined && !validStatuses.includes(availabilityStatus)) {
    return res.status(400).json({ success: false, message: 'Invalid availability status' });
  }
  const nextStatus = availabilityStatus || (['available', 'busy', 'responding'].includes(req.user.availability_status)
    ? req.user.availability_status
    : 'available');
  await req.user.update({
    latitude: isOffline ? null : hasCoordinates ? latitude : req.user.latitude,
    longitude: isOffline ? null : hasCoordinates ? longitude : req.user.longitude,
    availability_status: nextStatus,
    location_updated_at: isOffline ? null : hasCoordinates ? new Date() : req.user.location_updated_at
  });
  const payload = {
    user_id: req.user.user_id,
    name: req.user.name,
    role: req.user.role,
    latitude: req.user.latitude,
    longitude: req.user.longitude,
    availability_status: req.user.availability_status,
    location_updated_at: req.user.location_updated_at
  };
  const io = req.app.get('io');
  if (io) io.to('role:security').to('role:admin').emit('officer-location-updated', payload);
  return res.status(200).json({ success: true, data: payload });
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
