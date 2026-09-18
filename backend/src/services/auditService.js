const { AuditLog } = require('../models');

const recordAudit = async (req, { action, resourceType, resourceId = null, details = null } = {}) => {
  if (!action || !resourceType) return null;
  try {
    return await AuditLog.create({
      actor_id: req.user?.user_id || null,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details ? String(details).slice(0, 5000) : null,
      ip_address: req.ip || null
    });
  } catch {
    return null;
  }
};

module.exports = { recordAudit };
