const { AuditLog } = require('../models');

const recordAudit = async (req, {
  action,
  resourceType,
  resourceId = null,
  details = null,
  success = true,
  metadata = null,
  userAgent = null
} = {}) => {
  if (!action || !resourceType) return null;
  try {
    return await AuditLog.create({
      actor_id: req.user?.user_id || null,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details ? String(details).slice(0, 5000) : null,
      ip_address: req.ip || null,
      user_agent: userAgent || req.get?.('user-agent') || null,
      success: Boolean(success),
      metadata
    });
  } catch {
    return null;
  }
};

module.exports = { recordAudit };
