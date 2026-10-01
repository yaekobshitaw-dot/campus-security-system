const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { Incident, Response, User } = require('../models');
const bcrypt = require('bcryptjs');
const { uploadProfilePhoto } = require('../middleware/profilePhotoUpload');
const profilePhotoController = require('../controllers/profilePhotoController');
const { recordAudit } = require('../services/auditService');
const { notifyUsers } = require('../services/notificationPersistence');
const { withAdminAccountsLocked, assertAdminCapacity, assertUsableAdminRemains } = require('../services/adminAccountPolicy');

const LOCATION_STALE_AFTER_MS = 2 * 60 * 1000;
const normalizeRole = (role) => String(role || '').trim().toLowerCase();
const isSecurityRole = (role) => ['security', 'security_officer'].includes(normalizeRole(role));
const isValidCoordinate = (value, minimum, maximum) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value))
  && Number(value) >= minimum && Number(value) <= maximum;

router.use(authenticate);

router.get('/profile', (req, res) => {
  res.json({ success: true, data: req.user });
});

router.put('/me/profile-photo', uploadProfilePhoto.single('profile_photo'), profilePhotoController.update);
router.delete('/me/profile-photo', profilePhotoController.remove);
router.put('/:userId/profile-photo', authorize('admin'), uploadProfilePhoto.single('profile_photo'), profilePhotoController.update);
router.delete('/:userId/profile-photo', authorize('admin'), profilePhotoController.remove);

router.get('/security-officers', authorize('security', 'security_officer', 'admin'), async (req, res) => {
  try {
    const officers = await User.findAll({
      where: {
        is_active: true,
        [Op.or]: [{ role: 'security' }, { role: 'security_officer' }]
      },
      attributes: ['user_id', 'name', 'role', 'profile_photo_url', 'latitude', 'longitude', 'availability_status', 'location_updated_at']
    });
    // Only treat responses that are actually in responding state as making an officer busy.
    // 'assigned' (pending) should NOT mark the officer as responding.
    const activeResponses = await Response.findAll({
      where: { status: ['responding'] },
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
    const io = (req && req.app && typeof req.app.get === 'function') ? req.app.get('io') : null;
    const presence = io && io.presence ? io.presence : new Map();

    const data = officers.map((officer) => {
      const hasValidLocation = isValidCoordinate(officer.latitude, -90, 90)
        && isValidCoordinate(officer.longitude, -180, 180);
      const locationUpdatedAt = officer.location_updated_at ? new Date(officer.location_updated_at).getTime() : NaN;
      const hasFreshLocation = hasValidLocation && Number.isFinite(locationUpdatedAt)
        && locationUpdatedAt <= now && now - locationUpdatedAt <= LOCATION_STALE_AFTER_MS;
      const isResponding = respondingOfficerIds.has(officer.user_id) || normalizeRole(officer.availability_status) === 'responding';
      const presenceEntry = presence.get(officer.user_id);
      const isPresent = Boolean(presenceEntry && Number(presenceEntry.count) > 0);
      const dbStatus = normalizeRole(officer.availability_status);

      // Preserve explicit DB statuses: offline and busy should be respected.
      // Do not mark an officer offline purely because their location or socket presence is stale when the DB says 'available'.
      let availabilityStatus;
      if (isResponding) {
        availabilityStatus = 'responding';
      } else if (dbStatus === 'offline') {
        availabilityStatus = 'offline';
      } else if (dbStatus === 'busy') {
        availabilityStatus = 'busy';
      } else {
        availabilityStatus = 'available';
      }

      const isLiveLocation = hasFreshLocation && availabilityStatus !== 'offline';

      return {
        ...officer.toJSON(),
        availability_status: availabilityStatus,
        assignable: availabilityStatus === 'available',
        location_status: !hasValidLocation ? 'unavailable' : isLiveLocation ? 'live' : 'last_known',
        location_is_stale: hasValidLocation && !isLiveLocation,
        presence: isPresent
      };
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch security officers' });
  }
});

router.patch('/me/location', authorize('security', 'security_officer', 'admin'), async (req, res) => {
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

// Handler to update a user's explicit availability (used by security officers)
async function updateAvailabilityHandler(req, res) {
  try {
    const { availability_status } = req.body || {};
    const validStatuses = ['available', 'responding', 'busy', 'offline'];
    if (!validStatuses.includes(availability_status)) {
      return res.status(400).json({ success: false, message: 'Invalid availability status' });
    }

    // Prevent going offline while responding to an active incident
    if (availability_status === 'offline') {
      const activeResponse = await Response.findOne({ where: { responder_id: req.user.user_id, status: 'responding' } });
      if (activeResponse) {
        return res.status(400).json({ success: false, message: 'You cannot go offline while responding to an active incident.' });
      }
    }

    await req.user.update({ availability_status });

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
    if (io) io.to('role:security').to('role:admin').emit('officer-availability-updated', payload);

    return res.status(200).json({ success: true, data: payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update availability' });
  }
}

// Dedicated availability endpoint for officers (does not require location/GPS)
// Allow both canonical and legacy security role labels (some records may use 'security_officer')
router.patch('/me/availability', authorize('security', 'security_officer', 'admin'), updateAvailabilityHandler);

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

router.patch('/:userId', authorize('admin'), async (req, res) => {
  try {
    const allowedFields = ['name', 'email', 'phone', 'role', 'is_active'];
    const updates = Object.fromEntries(allowedFields.filter((field) => req.body?.[field] !== undefined).map((field) => [field, req.body[field]]));
    const roles = ['student', 'faculty', 'staff', 'security', 'security_officer', 'admin'];
    if (updates.role !== undefined && !roles.includes(updates.role)) return res.status(400).json({ success: false, message: 'Invalid role' });
    if (updates.email !== undefined) {
      updates.email = String(updates.email).trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(updates.email)) return res.status(400).json({ success: false, message: 'Email is invalid' });
    }
    if (updates.name !== undefined) {
      updates.name = String(updates.name).trim();
      if (!updates.name) return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (updates.phone !== undefined) updates.phone = String(updates.phone).trim() || null;
    if (updates.is_active !== undefined && typeof updates.is_active !== 'boolean') return res.status(400).json({ success: false, message: 'is_active must be a boolean' });
    if (req.body?.password !== undefined && req.body.password !== '') {
      if (typeof req.body.password !== 'string' || req.body.password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
      updates.password_hash = await bcrypt.hash(req.body.password, await bcrypt.genSalt(10));
    }
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'At least one user field is required' });

    const { user, previousRole } = await withAdminAccountsLocked(async (transaction, admins) => {
      const target = await User.findByPk(req.params.userId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!target) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }
      if (updates.role === 'admin' && target.role !== 'admin') assertAdminCapacity(admins);
      assertUsableAdminRemains(admins, target.user_id, updates);
      const roleBeforeUpdate = target.role;
      await target.update(updates, { transaction });
      return { user: target, previousRole: roleBeforeUpdate };
    });
    await recordAudit(req, { action: updates.role && updates.role !== previousRole ? 'user_role_changed' : 'user_updated', resourceType: 'user', resourceId: user.user_id, details: updates.role && updates.role !== previousRole ? `Role changed from ${previousRole} to ${updates.role}.` : null });
    await notifyUsers(req, { type: 'user_admin_event', title: 'User account updated', message: `${user.name}'s account was updated.`, resourceType: 'user', resourceId: user.user_id, link: '/users', dedupeKey: `user-updated:${user.user_id}:${user.updated_at}` });
    return res.json({ success: true, data: user.toJSON() });
  } catch (error) {
    const statusCode = error.statusCode || (error.name === 'SequelizeUniqueConstraintError' ? 409 : 500);
    const message = error.statusCode
      ? error.message
      : error.name === 'SequelizeUniqueConstraintError'
        ? 'Email already registered'
        : 'Failed to update user';
    return res.status(statusCode).json({ success: false, message });
  }
});

router.delete('/bulk', authorize('admin'), async (req, res) => {
  const { userIds } = req.body || {};
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!Array.isArray(userIds) || !userIds.length || userIds.some((userId) => (
    typeof userId !== 'string' || !uuidPattern.test(userId)
  ))) {
    return res.status(400).json({ success: false, message: 'A non-empty array of valid user IDs is required.' });
  }
  if (new Set(userIds.map((userId) => userId.toLowerCase())).size !== userIds.length) {
    return res.status(400).json({ success: false, message: 'Duplicate user IDs are not allowed.' });
  }

  const deleted = [];
  const failures = [];
  for (const userId of userIds) {
    let deletedUser;
    try {
      deletedUser = await withAdminAccountsLocked(async (transaction, admins) => {
        const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!user) {
          const error = new Error('User not found');
          error.statusCode = 404;
          throw error;
        }
        assertUsableAdminRemains(admins, user.user_id, { role: 'deleted' });
        await user.destroy({ transaction });
        return user;
      });
    } catch (error) {
      const statusCode = error.statusCode
        || (error.name === 'SequelizeForeignKeyConstraintError' ? 409 : 500);
      const message = error.statusCode
        ? error.message
        : error.name === 'SequelizeForeignKeyConstraintError'
          ? 'This user cannot be deleted because existing records still reference the account.'
          : 'Failed to delete user';
      failures.push({ user_id: userId, message, status: statusCode });
      continue;
    }

    deleted.push(deletedUser.user_id);
    await recordAudit(req, {
      action: 'user_deleted',
      resourceType: 'user',
      resourceId: deletedUser.user_id,
      details: `Deleted ${deletedUser.role} account.`
    });
    await notifyUsers(req, {
      type: 'user_admin_event',
      title: 'User account deleted',
      message: `${deletedUser.name}'s account was deleted.`,
      resourceType: 'user',
      resourceId: deletedUser.user_id,
      link: '/users',
      dedupeKey: `user-deleted:${deletedUser.user_id}`
    });
  }

  const success = failures.length === 0;
  return res.status(success ? 200 : 207).json({
    success,
    message: success
      ? `${deleted.length} user${deleted.length === 1 ? '' : 's'} deleted.`
      : `${deleted.length} user${deleted.length === 1 ? '' : 's'} deleted; ${failures.length} deletion${failures.length === 1 ? '' : 's'} failed.`,
    data: { deleted, failures }
  });
});

router.delete('/:userId', authorize('admin'), async (req, res) => {
  try {
    const deletedUser = await withAdminAccountsLocked(async (transaction, admins) => {
      const user = await User.findByPk(req.params.userId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }
      assertUsableAdminRemains(admins, user.user_id, { role: 'deleted' });
      await user.destroy({ transaction });
      return user;
    });
    await recordAudit(req, { action: 'user_deleted', resourceType: 'user', resourceId: deletedUser.user_id, details: `Deleted ${deletedUser.role} account.` });
    await notifyUsers(req, { type: 'user_admin_event', title: 'User account deleted', message: `${deletedUser.name}'s account was deleted.`, resourceType: 'user', resourceId: deletedUser.user_id, link: '/users', dedupeKey: `user-deleted:${deletedUser.user_id}` });
    return res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    const statusCode = error.statusCode
      || (error.name === 'SequelizeForeignKeyConstraintError' ? 409 : 500);
    const message = error.statusCode
      ? error.message
      : error.name === 'SequelizeForeignKeyConstraintError'
        ? 'This user cannot be deleted because existing records still reference the account.'
        : 'Failed to delete user';
    return res.status(statusCode).json({ success: false, message });
  }
});

router.patch('/:userId/status', authorize('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ success: false, message: 'is_active must be a boolean' });
    }

    const user = await withAdminAccountsLocked(async (transaction, admins) => {
      const target = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!target) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }
      assertUsableAdminRemains(admins, target.user_id, { is_active });
      await target.update({ is_active }, { transaction });
      return target;
    });
    await recordAudit(req, { action: is_active ? 'user_activated' : 'user_deactivated', resourceType: 'user', resourceId: user.user_id });
    await notifyUsers(req, { type: 'user_admin_event', title: 'User account updated', message: `${user.name} was ${is_active ? 'activated' : 'deactivated'}.`, resourceType: 'user', resourceId: user.user_id, link: '/users', dedupeKey: `user-status:${user.user_id}:${is_active}:${user.updated_at}` });

    return res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      data: user.toJSON()
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Failed to update user status' });
  }
});

// Export the router and expose the handler so unit tests can call the handler directly.
router.updateAvailabilityHandler = typeof updateAvailabilityHandler !== 'undefined' ? updateAvailabilityHandler : null;
module.exports = router;
