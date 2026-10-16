const { getUploadDirectories } = require('./uploadStorage');
const { incidentEvidenceDirectory } = getUploadDirectories();

module.exports = { incidentEvidenceDirectory };