const express = require('express');
const router = express.Router();
const { 
  getTeamMembers, 
  getTeamMember, 
  createTeamMember, 
  updateTeamMember, 
  deleteTeamMember,
  toggleTeamMemberStatus
} = require('../controllers/teamMembers');
const { protect, authorize } = require('../middleware/auth');

// Toutes les routes sont protégées
router.use(protect);

// Routes pour les membres de l'équipe
router.route('/')
  .get(getTeamMembers)
  .post(authorize('admin'), createTeamMember);

router.route('/:id')
  .get(getTeamMember)
  .put(authorize('admin'), updateTeamMember)
  .delete(authorize('admin'), deleteTeamMember);

router.route('/:id/toggle-status')
  .patch(authorize('admin'), toggleTeamMemberStatus);

module.exports = router;
