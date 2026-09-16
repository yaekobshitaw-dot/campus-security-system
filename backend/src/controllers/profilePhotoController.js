const fs = require('fs/promises');
const path = require('path');
const { profilePhotoDirectory } = require('../middleware/profilePhotoUpload');

const getPhotoUrl = (req, filename) => {
  const protocol = req.get('x-forwarded-proto')?.split(',')[0].trim() || req.protocol;
  return `${protocol}://${req.get('host')}/uploads/profile-photos/${filename}`;
};

const removeStoredPhoto = async (photoUrl) => {
  if (!photoUrl) return;
  let filename;
  try {
    filename = path.basename(new URL(photoUrl, 'http://localhost').pathname);
  } catch (_error) {
    return;
  }
  const filePath = path.resolve(profilePhotoDirectory, filename);
  if (path.dirname(filePath) !== path.resolve(profilePhotoDirectory)) return;
  await fs.unlink(filePath).catch(() => undefined);
};

exports.update = async (req, res) => {
  const targetUser = req.params?.userId ? await findTargetUser(req, res) : req.user;
  if (!targetUser) return;
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'A profile photo is required' });
  }

  const previousPhotoUrl = targetUser.profile_photo_url;
  const profilePhotoUrl = getPhotoUrl(req, req.file.filename);
  try {
    await targetUser.update({ profile_photo_url: profilePhotoUrl });
    await removeStoredPhoto(previousPhotoUrl);
    return res.status(200).json({ success: true, data: targetUser.toJSON() });
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => undefined);
    return res.status(500).json({ success: false, message: 'Unable to save profile photo' });
  }
};

exports.remove = async (req, res) => {
  const targetUser = req.params?.userId ? await findTargetUser(req, res) : req.user;
  if (!targetUser) return;
  const previousPhotoUrl = targetUser.profile_photo_url;
  try {
    await targetUser.update({ profile_photo_url: null });
    await removeStoredPhoto(previousPhotoUrl);
    return res.status(200).json({ success: true, data: targetUser.toJSON() });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to remove profile photo' });
  }
};

async function findTargetUser(req, res) {
  const { User } = require('../models');
  const user = await User.findByPk(req.params.userId);
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return null;
  }
  return user;
}