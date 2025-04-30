const express = require('express');
const passport = require('passport');
const router = express.Router();
const { 
  register, 
  login, 
  getMe, 
  forgotPassword, 
  resetPassword,
  googleCallback
} = require('../controllers/auth');
const { protect } = require('../middleware/auth');

// Routes publiques
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resetToken', resetPassword);

// Routes d'authentification Google
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email']
  })
);

router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/login' 
  }),
  googleCallback
);

// Routes protégées
router.get('/me', protect, getMe);

module.exports = router;
