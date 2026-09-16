const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const profilePhotoController = require('../src/controllers/profilePhotoController');
const { profilePhotoDirectory, profilePhotoFileFilter } = require('../src/middleware/profilePhotoUpload');

const makeResponse = () => ({
  statusCode: null,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; }
});

const makeUser = (photo = null) => ({
  user_id: 'user-1',
  profile_photo_url: photo,
  update: async function update(attributes) { Object.assign(this, attributes); },
  toJSON() { return { user_id: this.user_id, profile_photo_url: this.profile_photo_url }; }
});

test('rejects unsupported profile photo types', () => {
  let filterError;
  profilePhotoFileFilter({}, { mimetype: 'application/pdf', originalname: 'profile.pdf' }, (error) => { filterError = error; });
  assert.equal(filterError.statusCode, 400);
});

test('updates and removes an authenticated user profile photo', async () => {
  fs.mkdirSync(profilePhotoDirectory, { recursive: true });
  const filename = `profile-photo-test-${Date.now()}.jpg`;
  const filePath = path.join(profilePhotoDirectory, filename);
  fs.writeFileSync(filePath, 'photo');
  const user = makeUser();
  const request = { protocol: 'http', get: () => 'localhost:5002', user, file: { filename, path: filePath } };
  const updateResponse = makeResponse();

  await profilePhotoController.update(request, updateResponse);
  assert.equal(updateResponse.statusCode, 200);
  assert.match(user.profile_photo_url, new RegExp(`/uploads/profile-photos/${filename}$`));
  assert.equal(fs.existsSync(filePath), true);

  const removeResponse = makeResponse();
  await profilePhotoController.remove({ user }, removeResponse);
  assert.equal(removeResponse.statusCode, 200);
  assert.equal(user.profile_photo_url, null);
  assert.equal(fs.existsSync(filePath), false);
});