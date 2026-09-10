const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const assistantController = require('../controllers/assistantController');

const router = express.Router();
router.post('/chat', authenticate, authorize('student', 'faculty', 'staff', 'security', 'admin'), assistantController.chat);

module.exports = router;