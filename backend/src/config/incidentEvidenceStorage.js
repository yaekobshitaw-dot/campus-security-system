const path = require('path');

const configuredDirectory = String(process.env.INCIDENT_EVIDENCE_STORAGE_DIR || '').trim();
const incidentEvidenceDirectory = configuredDirectory
  ? path.resolve(configuredDirectory)
  : path.resolve(__dirname, '../../uploads');

module.exports = { incidentEvidenceDirectory };