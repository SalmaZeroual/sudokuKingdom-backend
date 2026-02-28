const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-code', authController.resendVerificationCode);

// Password reset routes
router.post('/forgot-password', authController.requestPasswordReset);
router.post('/verify-reset-code', authController.verifyResetCode);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.get('/me', authenticate, authController.getMe);
router.get('/leaderboard/global', authController.getGlobalLeaderboard);
router.get('/leaderboard/:league', authController.getLeagueLeaderboard);

// ✅ NOUVEAU : Suppression de compte (protégée, mot de passe requis)
router.delete('/delete-account', authenticate, authController.deleteAccount);

// ✅ NOUVEAU : Suppression de compte (protégée, mot de passe requis dans le body)
router.delete('/delete-account', authenticate, authController.deleteAccount);

module.exports = router;