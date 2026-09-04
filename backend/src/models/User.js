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
  phone: {
    type: DataTypes.STRING(32),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  push_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true
  },
  location_updated_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  availability_status: {
    type: DataTypes.ENUM('available', 'responding', 'busy', 'offline'),
    allowNull: false,
    defaultValue: 'offline'
  },
  reset_token_hash: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  reset_token_expires_at: {
    type: DataTypes.DATE,
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
  if (!candidatePassword || !this.password_hash) {
    return false;
  }

  const storedPassword = String(this.password_hash);

  if (storedPassword.startsWith('$2') || storedPassword.startsWith('$2a') || storedPassword.startsWith('$2b')) {
    const isMatch = await bcrypt.compare(candidatePassword, storedPassword);
    if (isMatch) {
      return true;
    }

    return false;
  }

  const isLegacyMatch = storedPassword === String(candidatePassword);
  if (isLegacyMatch) {
    const newHash = await bcrypt.hash(String(candidatePassword), await bcrypt.genSalt(10));
    await this.update({ password_hash: newHash }).catch(() => undefined);
    return true;
  }

  return false;
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password_hash;
  delete values.push_token;
  delete values.reset_token_hash;
  delete values.reset_token_expires_at;
  return values;
};

module.exports = User;
