const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { getUploadDirectories } = require('../src/config/uploadStorage');

test('uses the existing local upload directories by default', () => {
    const directories = getUploadDirectories({});
    const uploadsDirectory = path.resolve(__dirname, '../uploads');

    assert.deepEqual(directories, {
        incidentEvidenceDirectory: uploadsDirectory,
        profilePhotoDirectory: path.join(uploadsDirectory, 'profile-photos')
    });
});

test('places both upload types under the configured persistent volume', () => {
    const volumeDirectory = path.resolve('/data');

    assert.deepEqual(getUploadDirectories({ UPLOADS_DIR: '/data' }), {
        incidentEvidenceDirectory: volumeDirectory,
        profilePhotoDirectory: path.join(volumeDirectory, 'profile-photos')
    });
});

test('preserves existing per-purpose storage directory overrides', () => {
    assert.deepEqual(getUploadDirectories({
        UPLOADS_DIR: '/data',
        INCIDENT_EVIDENCE_STORAGE_DIR: '/evidence',
        PROFILE_PHOTO_STORAGE_DIR: '/photos'
    }), {
        incidentEvidenceDirectory: path.resolve('/evidence'),
        profilePhotoDirectory: path.resolve('/photos')
    });
});