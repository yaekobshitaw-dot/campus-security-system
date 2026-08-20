// src/models/User.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.UUID,
    defaultValue: uuidv4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('student', 'faculty', 'staff', 'security', 'admin'),
    defaultValue: 'student'
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  push_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password_hash) {
        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(user.password_hash, salt);
      }
    }
  }
});

User.prototype.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password_hash);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password_hash;
  delete values.push_token;
  return values;
};

module.exports = User;
