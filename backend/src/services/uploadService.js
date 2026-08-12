const path = require('path');

const processIncidentPhotos = async (files = [], incidentId) => {
  return files.map((file) => {
    const filename = path.basename(file.path || file.filename || `${incidentId}-${Date.now()}`);
    return `/uploads/${filename}`;
  });
};

module.exports = { processIncidentPhotos };
