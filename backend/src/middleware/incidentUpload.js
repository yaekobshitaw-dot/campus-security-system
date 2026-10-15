const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { incidentEvidenceDirectory: uploadDirectory } = require('../config/incidentEvidenceStorage');
const { cleanupUploadedEvidence } = require('../services/evidenceService');
const { hasValidImageSignature } = require('../utils/imageSignature');

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    callback(null, safeName);
  }
});

const imageOnly = (_req, file, callback) => {
  const allowedTypes = new Map([
    ['image/jpeg', ['.jpg', '.jpeg']],
    ['image/png', ['.png']],
    ['image/webp', ['.webp']],
    ['image/gif', ['.gif']]
  ]);
  const extensions = allowedTypes.get(file.mimetype);
  const extension = path.extname(file.originalname).toLowerCase();
  if (extensions?.includes(extension)) {
    return callback(null, true);
  }

  const error = new Error('Incident evidence must be a supported image type with a matching extension');
  error.statusCode = 400;
  error.code = 'INVALID_INCIDENT_PHOTO_TYPE';
  return callback(error);
};

const uploadIncidentPhotos = multer({
  storage,
  fileFilter: imageOnly,
  limits: { files: 5, fileSize: 10 * 1024 * 1024 }
});

const validateIncidentPhotoContents = (req, res, next) => Promise.resolve().then(async () => {
  for (const file of req.files || []) {
    if (!await hasValidImageSignature(file.path, file.mimetype)) {
      const error = new Error('Incident evidence content does not match its image type');
      error.statusCode = 400;
      error.code = 'INVALID_INCIDENT_PHOTO_CONTENT';
      throw error;
    }
  }
}).then(() => next()).catch(async (error) => {
  await cleanupUploadedEvidence(req.files);
  next(error);
});

module.exports = { uploadIncidentPhotos, validateIncidentPhotoContents };
