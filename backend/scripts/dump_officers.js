require('dotenv').config();

const { Op } = require('sequelize');
const { sequelize, User, Response, Incident } = require('../src/models');

const LOCATION_STALE_AFTER_MS = 2 * 60 * 1000;
const normalizeRole = (role) => String(role || '').trim().toLowerCase();
const isValidCoordinate = (value, minimum, maximum) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value))
  && Number(value) >= minimum && Number(value) <= maximum;

(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    const officers = await User.findAll({
      where: {
        is_active: true,
        [Op.or]: [{ role: 'security' }, { role: 'security_officer' }]
      },
      attributes: ['user_id', 'name', 'email', 'role', 'profile_photo_url', 'latitude', 'longitude', 'availability_status', 'location_updated_at']
    });

    const activeResponses = await Response.findAll({
      where: { status: ['responding'] },
      attributes: ['responder_id', 'status'],
      include: [{ model: Incident, as: 'incident', attributes: ['incident_id', 'status'], where: { status: ['reported', 'investigating', 'dispatched', 'on_scene'] }, required: false }]
    });
    const respondingOfficerIds = new Set(activeResponses.map((r) => r.responder_id));

    const now = Date.now();

    const rows = officers.map((officer) => {
      const hasValidLocation = isValidCoordinate(officer.latitude, -90, 90)
        && isValidCoordinate(officer.longitude, -180, 180);
      const locationUpdatedAt = officer.location_updated_at ? new Date(officer.location_updated_at).getTime() : NaN;
      const hasFreshLocation = hasValidLocation && Number.isFinite(locationUpdatedAt)
        && locationUpdatedAt <= now && now - locationUpdatedAt <= LOCATION_STALE_AFTER_MS;
      const isResponding = respondingOfficerIds.has(officer.user_id) || normalizeRole(officer.availability_status) === 'responding';
      const dbStatus = normalizeRole(officer.availability_status);

      let availabilityStatus;
      if (isResponding) availabilityStatus = 'responding';
      else if (dbStatus === 'offline') availabilityStatus = 'offline';
      else if (dbStatus === 'busy') availabilityStatus = 'busy';
      else availabilityStatus = 'available';

      const isLiveLocation = hasFreshLocation && availabilityStatus !== 'offline';

      return {
        user_id: officer.user_id,
        name: officer.name,
        email: officer.email,
        role: officer.role,
        db_availability_status: officer.availability_status,
        api_availability_status: availabilityStatus,
        latitude: officer.latitude,
        longitude: officer.longitude,
        location_status: !hasValidLocation ? 'unavailable' : isLiveLocation ? 'live' : 'last_known',
        location_is_stale: hasValidLocation && !isLiveLocation
      };
    });

    console.table(rows, ['user_id','name','email','role','db_availability_status','api_availability_status','location_status','location_is_stale']);
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err.message, err);
    process.exit(1);
  }
})();
