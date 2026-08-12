const crypto = require('crypto');
const axios = require('axios');

// Generate random token
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000; // Distance in meters
};

// Get location address from coordinates (reverse geocoding)
const getLocationAddress = async (lat, lng) => {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );
    if (response.data && response.data.display_name) {
      return response.data.display_name;
    }
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};

// Format date
const formatDate = (date) => {
  return new Date(date).toISOString();
};

// Get time ago
const timeAgo = (date) => {
  const now = new Date();
  const diff = Math.floor((now - new Date(date)) / 1000);
  
  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2419200) return `${Math.floor(diff / 604800)} weeks ago`;
  if (diff < 29030400) return `${Math.floor(diff / 2419200)} months ago`;
  return `${Math.floor(diff / 29030400)} years ago`;
};

// Validate email
const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

// Validate phone number
const isValidPhone = (phone) => {
  const regex = /^[0-9+\s-]+$/;
  return regex.test(phone);
};

// Mask sensitive data
const maskEmail = (email) => {
  if (!email) return '';
  const [username, domain] = email.split('@');
  if (username.length <= 3) return `${username}@${domain}`;
  return `${username.slice(0, 3)}...@${domain}`;
};

// Pagination helper
const getPagination = (page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  return { offset, limit: parseInt(limit) };
};

// Sort helper
const getSortOrder = (sort = 'created_at', order = 'DESC') => {
  return [[sort, order.toUpperCase()]];
};

module.exports = {
  generateToken,
  calculateDistance,
  getLocationAddress,
  formatDate,
  timeAgo,
  isValidEmail,
  isValidPhone,
  maskEmail,
  getPagination,
  getSortOrder
};