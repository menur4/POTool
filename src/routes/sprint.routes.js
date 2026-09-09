const express = require('express');
const router = express.Router();
const {
  getSprints,
  getSprint,
  createSprint,
  updateSprint,
  deleteSprint,
  activateSprint,
  closeSprint,
  clearSprintEpics,
  calculateCapacity,
  getVelocityEstimate,
  getDeliveredStoryPoints,
  getLiveDeliveredFromJira,
  syncSprintDelivered,
  syncAllDelivered,
  updateSprintDelivered,
  reopenSprint,
  getJiraReconciliation,
  createSprintFromJira,
  linkSprintToJira,
  generateNextSprints
} = require('../controllers/sprint.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// Temporairement désactivé pour le développement
// router.use(protect);

// Routes utilitaires
router.post('/calculate-capacity', calculateCapacity);
router.get('/velocity-estimate', getVelocityEstimate);

// Réconciliation Jira (avant /:id pour éviter les collisions de route)
router.get('/jira-reconciliation', getJiraReconciliation);
router.post('/from-jira', createSprintFromJira);
router.post('/link-jira', linkSprintToJira);
router.post('/generate-next', generateNextSprints);

// Routes CRUD
router.route('/')
  .get(getSprints)
  .post(createSprint);

router.route('/:id')
  .get(getSprint)
  .put(updateSprint)
  .delete(deleteSprint);

// Routes d'actions
router.get('/:id/delivered-sp', getDeliveredStoryPoints);
router.get('/:id/delivered-live', getLiveDeliveredFromJira);
router.post('/sync-delivered-all', syncAllDelivered);
router.post('/:id/sync-delivered', syncSprintDelivered);
router.patch('/:id/delivered', updateSprintDelivered);
router.delete('/:id/epics', clearSprintEpics);
router.post('/:id/activate', activateSprint);
router.post('/:id/close', closeSprint);
router.post('/:id/reopen', reopenSprint);

module.exports = router;
