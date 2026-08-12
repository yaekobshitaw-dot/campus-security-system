const { User } = require('../models');
const { logger } = require('../utils/logger');

exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({ attributes: { exclude: ['password_hash', 'refresh_token'] } });
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error('Get users failed:', error);
    res.status(500).json({ success: false, message: 'Unable to load users' });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password_hash', 'refresh_token'] } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Get user failed:', error);
    res.status(500).json({ success: false, message: 'Unable to load user' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    await user.update(req.body);
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Update user failed:', error);
    res.status(500).json({ success: false, message: 'Unable to update user' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    await user.destroy();
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    logger.error('Delete user failed:', error);
    res.status(500).json({ success: false, message: 'Unable to delete user' });
  }
};
