// src/controllers/authController.js
const { User } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  console.warn('JWT_SECRET is not configured. Authentication will fail until it is set.');
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
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
    const { name, email, password, role } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const requestedRole = String(role || '').trim().toLowerCase();

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
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
    const { name, email, password, role } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const requestedRole = String(role || '').trim().toLowerCase();

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
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

    const isValid = await bcrypt.compare(password, user.password_hash);
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

exports.logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
};
