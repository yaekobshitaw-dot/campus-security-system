// src/controllers/authController.js
const { User } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendEmail } = require('../services/emailService');

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  console.warn('JWT_SECRET is not configured. Authentication will fail until it is set.');
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizePhone = (phone) => String(phone || '').trim();
const normalizeRole = (role, allowedRoles, fallbackRole = 'student') => {
  const normalized = String(role || '').trim().toLowerCase();
  return allowedRoles.includes(normalized) ? normalized : fallbackRole;
};

const PUBLIC_REGISTRATION_ROLES = ['student', 'faculty', 'staff'];
const ADMIN_MANAGED_ROLES = ['student', 'faculty', 'staff', 'security', 'admin'];

const generateToken = (user) => {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const requestedRole = String(role || '').trim().toLowerCase();

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    if (normalizedPhone && !/^\+?[0-9\s()-]{7,20}$/.test(normalizedPhone)) {
      return res.status(400).json({ success: false, message: 'Phone number is invalid.' });
    }

    if (!PUBLIC_REGISTRATION_ROLES.includes(requestedRole) && requestedRole !== '') {
      return res.status(400).json({
        success: false,
        message: 'Public registration is limited to student, faculty, or staff roles'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const allowedRole = normalizeRole(requestedRole || 'student', PUBLIC_REGISTRATION_ROLES, 'student');
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password_hash: password,
      phone: normalizedPhone || null,
      role: allowedRole
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user: user.toJSON(), accessToken: token }
    });
  } catch (error) {
    const message = error.message === 'JWT_SECRET is not configured'
      ? 'Authentication is not configured correctly'
      : 'Registration failed';

    return res.status(500).json({ success: false, message });
  }
};

exports.createUserByAdmin = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const requestedRole = String(role || '').trim().toLowerCase();

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    if (normalizedPhone && !/^\+?[0-9\s()-]{7,20}$/.test(normalizedPhone)) {
      return res.status(400).json({ success: false, message: 'Phone number is invalid.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    if (!ADMIN_MANAGED_ROLES.includes(requestedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be one of: student, faculty, staff, security, admin'
      });
    }

    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password_hash: password,
      phone: normalizedPhone || null,
      role: requestedRole
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user: user.toJSON() }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'User creation failed' });
  }
};

exports.setupFirstAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    const existingAdmin = await User.findOne({ where: { role: 'admin' } });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'An admin user already exists. First-admin setup is disabled after initialization.'
      });
    }

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const firstAdmin = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password_hash: password,
      role: 'admin',
      is_active: true
    });

    return res.status(201).json({
      success: true,
      message: 'First admin created successfully',
      data: { user: firstAdmin.toJSON() }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'First admin setup failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ where: { email: normalizedEmail } });
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user: user.toJSON(), accessToken: token }
    });
  } catch (error) {
    const message = error.message === 'JWT_SECRET is not configured'
      ? 'Authentication is not configured correctly'
      : 'Login failed';

    return res.status(500).json({ success: false, message });
  }
};

exports.forgotPassword = async (req, res) => {
  const genericResponse = {
    success: true,
    message: 'If an account exists for that email, password reset instructions have been sent.'
  };

  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    if (!normalizedEmail) return res.status(200).json(genericResponse);

    const user = await User.findOne({ where: { email: normalizedEmail, is_active: true } });
    if (!user) return res.status(200).json(genericResponse);

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.update({ reset_token_hash: resetTokenHash, reset_token_expires_at: expiresAt });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
    const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${resetToken}`;
    await sendEmail(
      user.email,
      'Campus Security password reset',
      `<p>Use the link below to set a new password. It expires in 15 minutes.</p><p><a href="${resetUrl}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`
    );

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error('Password reset request failed:', error.message);
    return res.status(200).json(genericResponse);
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'A valid token and password of at least 8 characters are required' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ where: { reset_token_hash: tokenHash } });
    if (!user || !user.reset_token_expires_at || new Date(user.reset_token_expires_at) <= new Date()) {
      return res.status(400).json({ success: false, message: 'This reset link is invalid or expired' });
    }

    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    await user.update({
      password_hash: passwordHash,
      reset_token_hash: null,
      reset_token_expires_at: null
    });

    return res.status(200).json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to reset password' });
  }
};

exports.logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
};
