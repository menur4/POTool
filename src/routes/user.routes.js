const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');

// Placeholder pour les futures routes utilisateur
router.get('/profile', protect, (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      id: req.user.id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      role: req.user.role
    }
  });
});

module.exports = router;
