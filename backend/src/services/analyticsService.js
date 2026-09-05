const { logger } = require('../utils/logger');
const { Incident } = require('../models');
const { Op } = require('sequelize');

const getIncidentAnalytics = async (filters = {}) => {
  logger.info('Computing incident analytics', { filters });
  const where = {};
  if (filters.from || filters.to) {
    where.created_at = {};
    if (filters.from) where.created_at[Op.gte] = new Date(filters.from);
    if (filters.to) where.created_at[Op.lte] = new Date(filters.to);
  }
  const incidents = await Incident.findAll({
    where,
    attributes: ['severity', 'status', 'created_at'],
    raw: true
  });
  const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
  const byStatus = { reported: 0, investigating: 0, acknowledged: 0, dispatched: 0, on_scene: 0, resolved: 0, closed: 0, cancelled: 0 };
  const trends = new Map();
  incidents.forEach(({ severity, status, created_at }) => {
    if (Object.prototype.hasOwnProperty.call(bySeverity, severity)) bySeverity[severity] += 1;
    if (Object.prototype.hasOwnProperty.call(byStatus, status)) byStatus[status] += 1;
    const day = new Date(created_at).toISOString().slice(0, 10);
    trends.set(day, (trends.get(day) || 0) + 1);
  });
  return {
    total_incidents: incidents.length,
    by_severity: bySeverity,
    by_status: byStatus,
    trends: [...trends.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, count]) => ({ date, count }))
  };
};

module.exports = { getIncidentAnalytics };
