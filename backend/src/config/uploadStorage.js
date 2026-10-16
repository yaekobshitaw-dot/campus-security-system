const path = require('path');

const defaultUploadsDirectory = path.resolve(__dirname, '../../uploads');

const resolveDirectory = (configuredDirectory, fallback) => {
    const value = String(configuredDirectory || '').trim();
    return value ? path.resolve(value) : fallback;
};

const getUploadDirectories = (environment = process.env) => {
    const uploadsDirectory = resolveDirectory(environment.UPLOADS_DIR, defaultUploadsDirectory);
    return {
        incidentEvidenceDirectory: resolveDirectory(environment.INCIDENT_EVIDENCE_STORAGE_DIR, uploadsDirectory),
        profilePhotoDirectory: resolveDirectory(environment.PROFILE_PHOTO_STORAGE_DIR, path.join(uploadsDirectory, 'profile-photos'))
    };
};

module.exports = { getUploadDirectories };