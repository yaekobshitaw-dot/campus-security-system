const path = require('path');

const processIncidentPhotos = async (files = [], incidentId) => {
  return files.map((file) => {
    const filename = path.basename(file.path || file.filename || `${incidentId}-${Date.now()}`);
    return {
      storage_key: filename,
      original_filename: path.basename(file.originalname || filename),
      content_type: file.mimetype || null,
      created_at: new Date().toISOString()
    };
  });
};

module.exports = { processIncidentPhotos };
