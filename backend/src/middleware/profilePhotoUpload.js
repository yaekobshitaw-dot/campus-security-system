const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { hasValidImageSignature } = require('../utils/imageSignature');

const configuredProfilePhotoDirectory = String(process.env.PROFILE_PHOTO_STORAGE_DIR || '').trim();
const profilePhotoDirectory = configuredProfilePhotoDirectory ?
    path.resolve(configuredProfilePhotoDirectory) : path.resolve(__dirname, '../../uploads/profile-photos');
fs.mkdirSync(profilePhotoDirectory, { recursive: true });

const allowedTypes = new Map([
    ['image/jpeg', ['.jpg', '.jpeg']],
    ['image/png', ['.png']],
    ['image/webp', ['.webp']],
    ['image/gif', ['.gif']]
]);

const storage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, profilePhotoDirectory),
    filename: (_req, file, callback) => {
        const extension = allowedTypes.get(file.mimetype)[0];
        callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    }
});

const fileFilter = (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const expectedExtension = allowedTypes.get(file.mimetype);
    if (expectedExtension && expectedExtension.includes(extension)) {
        return callback(null, true);
    }

    const error = new Error('Only JPEG, PNG, WebP, and GIF images are supported');
    error.statusCode = 400;
    return callback(error);
};

const uploadProfilePhoto = multer({
    storage,
    fileFilter,
    limits: { files: 1, fileSize: 5 * 1024 * 1024 }
});

const validateProfilePhotoContent = (req, res, next) => Promise.resolve().then(async () => {
    if (!req.file || await hasValidImageSignature(req.file.path, req.file.mimetype)) return;
    const error = new Error('Profile photo content does not match its image type');
    error.statusCode = 400;
    error.code = 'INVALID_PROFILE_PHOTO_CONTENT';
    throw error;
}).then(() => next()).catch(async (error) => {
    if (req.file?.path && path.resolve(req.file.path) === path.resolve(profilePhotoDirectory, req.file.filename)) {
        await fs.promises.unlink(req.file.path).catch(() => undefined);
    }
    next(error);
});

module.exports = { profilePhotoDirectory, uploadProfilePhoto, profilePhotoFileFilter: fileFilter, validateProfilePhotoContent };
