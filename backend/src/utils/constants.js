// Incident types
const INCIDENT_TYPES = {
  FIRE: 'fire',
  MEDICAL: 'medical',
  SECURITY_THREAT: 'security_threat',
  SUSPICIOUS_PACKAGE: 'suspicious_package',
  FLOOD: 'flood',
  POWER_OUTAGE: 'power_outage',
  MISSING_PERSON: 'missing_person',
  NATURAL_DISASTER: 'natural_disaster',
  HAZARDOUS_MATERIAL: 'hazardous_material',
  ASSAULT: 'assault',
  THEFT: 'theft',
  VANDALISM: 'vandalism',
  OTHER: 'other'
};

// Severity levels
const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Incident statuses
const INCIDENT_STATUS = {
  REPORTED: 'reported',
  ACKNOWLEDGED: 'acknowledged',
  DISPATCHED: 'dispatched',
  ON_SCENE: 'on_scene',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
};

// User roles
const USER_ROLES = {
  STUDENT: 'student',
  FACULTY: 'faculty',
  STAFF: 'staff',
  SECURITY: 'security',
  ADMIN: 'admin'
};

// Alert channels
const ALERT_CHANNELS = {
  PUSH: 'push',
  SMS: 'sms',
  EMAIL: 'email',
  DASHBOARD: 'dashboard'
};

// Notification types
const NOTIFICATION_TYPES = {
  INCIDENT_REPORTED: 'incident_reported',
  INCIDENT_UPDATED: 'incident_updated',
  INCIDENT_RESOLVED: 'incident_resolved',
  EMERGENCY_ALERT: 'emergency_alert',
  SOS_ALERT: 'sos_alert',
  SYSTEM_UPDATE: 'system_update',
  SECURITY_TIP: 'security_tip'
};

// Response statuses
const RESPONSE_STATUS = {
  ASSIGNED: 'assigned',
  EN_ROUTE: 'en_route',
  ON_SCENE: 'on_scene',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Severity priority mapping
const SEVERITY_PRIORITY = {
  [SEVERITY_LEVELS.LOW]: 1,
  [SEVERITY_LEVELS.MEDIUM]: 2,
  [SEVERITY_LEVELS.HIGH]: 3,
  [SEVERITY_LEVELS.CRITICAL]: 4
};

// Incident type labels
const INCIDENT_TYPE_LABELS = {
  [INCIDENT_TYPES.FIRE]: 'Fire/Hazard',
  [INCIDENT_TYPES.MEDICAL]: 'Medical Emergency',
  [INCIDENT_TYPES.SECURITY_THREAT]: 'Security Threat',
  [INCIDENT_TYPES.SUSPICIOUS_PACKAGE]: 'Suspicious Package',
  [INCIDENT_TYPES.FLOOD]: 'Flood/Water Damage',
  [INCIDENT_TYPES.POWER_OUTAGE]: 'Power Outage',
  [INCIDENT_TYPES.MISSING_PERSON]: 'Missing Person',
  [INCIDENT_TYPES.NATURAL_DISASTER]: 'Natural Disaster',
  [INCIDENT_TYPES.HAZARDOUS_MATERIAL]: 'Hazardous Material',
  [INCIDENT_TYPES.ASSAULT]: 'Assault',
  [INCIDENT_TYPES.THEFT]: 'Theft',
  [INCIDENT_TYPES.VANDALISM]: 'Vandalism',
  [INCIDENT_TYPES.OTHER]: 'Other'
};

// Severity color mapping
const SEVERITY_COLORS = {
  [SEVERITY_LEVELS.LOW]: '#4CAF50',    // Green
  [SEVERITY_LEVELS.MEDIUM]: '#FF9800', // Orange
  [SEVERITY_LEVELS.HIGH]: '#F44336',   // Red
  [SEVERITY_LEVELS.CRITICAL]: '#9C27B0' // Purple
};

module.exports = {
  INCIDENT_TYPES,
  SEVERITY_LEVELS,
  INCIDENT_STATUS,
  USER_ROLES,
  ALERT_CHANNELS,
  NOTIFICATION_TYPES,
  RESPONSE_STATUS,
  SEVERITY_PRIORITY,
  INCIDENT_TYPE_LABELS,
  SEVERITY_COLORS
};