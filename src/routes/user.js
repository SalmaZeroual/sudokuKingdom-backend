const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticate);

// ==========================================
// USER PROFILE ROUTES
// ==========================================

// Get current user profile
router.get('/profile', userController.getProfile);

// Update username
router.put('/profile', userController.updateProfile);

// Change password
router.put('/password', userController.changePassword);

// ✅ NOUVEAU : Update avatar
router.put('/avatar', userController.updateAvatar);

module.exports = router;