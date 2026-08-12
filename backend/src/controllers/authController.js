// src/controllers/authController.js
const { User } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const generateToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'your_jwt_secret_123456789',
    { expiresIn: '7d' }
  );
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    console.log('📝 Register attempt:', email);
    
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }
    
    const user = await User.create({
      name,
      email,
      password_hash: password,
      role: role || 'student'
    });
    
    const token = generateToken(user);
    console.log('✅ User registered:', email);
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user: user.toJSON(), accessToken: token }
    });
  } catch (error) {
    console.error('❌ Register error:', error.message);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Login attempt:', email);
    
    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    
    console.log('👤 User found:', user.email);
    console.log('🔑 Password hash:', user.password_hash);
    
    // Compare password
    const isValid = await bcrypt.compare(password, user.password_hash);
    console.log('✅ Password valid:', isValid);
    
    if (!isValid) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    
    const token = generateToken(user);
    console.log('✅ User logged in:', email);
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user: user.toJSON(), accessToken: token }
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};
