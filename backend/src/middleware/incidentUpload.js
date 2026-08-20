const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDirectory = path.resolve(__dirname, '../../uploads');
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
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    return callback(null, true);
  }

  return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'photos'));
};

const uploadIncidentPhotos = multer({
  storage,
  fileFilter: imageOnly,
  limits: { files: 5, fileSize: 10 * 1024 * 1024 }
});

module.exports = { uploadIncidentPhotos };
