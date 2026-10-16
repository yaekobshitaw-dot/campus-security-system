const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { Readable } = require('node:stream');
const { uploadIncidentPhotos, validateIncidentPhotoContents } = require('../src/middleware/incidentUpload');
const { uploadDirectory } = require('../src/services/evidenceService');

test('incident upload filter and storage resolve filename extensions', async() => {
    uploadIncidentPhotos.fileFilter({}, {
        originalname: 'incident-photo.PNG',
        mimetype: 'image/png',
    }, (error, accepted) => {
        assert.ifError(error);
        assert.equal(accepted, true);
    });

    const stored = await new Promise((resolve, reject) => {
        uploadIncidentPhotos.storage._handleFile({}, {
            originalname: 'incident-photo.PNG',
            stream: Readable.from(['test evidence']),
        }, (error, info) => error ? reject(error) : resolve(info));
    });

    try {
        assert.match(stored.filename, /\.png$/);
        assert.equal(fs.existsSync(stored.path), true);
    } finally {
        fs.rmSync(stored.path, { force: true });
    }
});

test('accepts image bytes that match the declared incident photo type', async() => {
    const filename = `incident-upload-signature-${process.pid}-${Date.now()}.png`;
    const filePath = path.join(uploadDirectory, filename);
    fs.mkdirSync(uploadDirectory, { recursive: true });
    fs.writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    let passed = false;

    try {
        await validateIncidentPhotoContents({ files: [{ filename, path: filePath, mimetype: 'image/png' }] }, {}, (error) => {
            assert.ifError(error);
            passed = true;
        });
        assert.equal(passed, true);
    } finally {
        fs.rmSync(filePath, { force: true });
    }
});

test('rejects and removes bytes that do not match the declared image type', async() => {
    const filename = `incident-upload-invalid-${process.pid}-${Date.now()}.png`;
    const filePath = path.join(uploadDirectory, filename);
    fs.mkdirSync(uploadDirectory, { recursive: true });
    fs.writeFileSync(filePath, 'not a png');
    let validationError;

    await validateIncidentPhotoContents({ files: [{ filename, path: filePath, mimetype: 'image/png' }] }, {}, (error) => {
        validationError = error;
    });

    assert.equal(validationError.statusCode, 400);
    assert.equal(validationError.code, 'INVALID_INCIDENT_PHOTO_CONTENT');
    assert.equal(fs.existsSync(filePath), false);
});