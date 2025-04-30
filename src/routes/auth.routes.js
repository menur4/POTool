const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const googleAuthController = require('../controllers/google-auth.controller');
const { protect } = require('../middleware/auth.middleware');

// Routes publiques
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Routes protégées (nécessitent une authentification)
router.get('/me', protect, authController.getMe);
router.put('/me', protect, authController.updateMe);
router.put('/change-password', protect, authController.changePassword);

// Routes d'authentification Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  googleAuthController.googleCallback
);
router.get('/check', googleAuthController.checkAuth);
router.get('/logout', googleAuthController.logout);

module.exports = router;
