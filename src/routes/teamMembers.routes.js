const express = require('express');
const router = express.Router();
const { 
  getTeamMembers, 
  getTeamMember, 
  createTeamMember, 
  updateTeamMember, 
  deleteTeamMember,
  toggleTeamMemberStatus
} = require('../controllers/teamMembers.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// Temporairement désactivé pour le développement
// router.use(protect);

// Routes pour les membres de l'équipe
router.route('/')
  .get(getTeamMembers)
  // Temporairement désactivé pour le développement
  // .post(restrictTo('admin'), createTeamMember);
  .post(createTeamMember);

router.route('/:id')
  .get(getTeamMember)
  // Temporairement désactivé pour le développement
  // .put(restrictTo('admin'), updateTeamMember)
  // .delete(restrictTo('admin'), deleteTeamMember);
  .put(updateTeamMember)
  .delete(deleteTeamMember);

router.route('/:id/toggle-status')
  // Temporairement désactivé pour le développement
  // .patch(restrictTo('admin'), toggleTeamMemberStatus);
  .patch(toggleTeamMemberStatus);

module.exports = router;
