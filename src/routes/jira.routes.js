const express = require('express');
const router = express.Router();
const {
  getConfig,
  saveConfig,
  testConnection,
  getProjects,
  getJiraFields,
  previewJql,
  getJiraSprints,
  syncFromJira,
  importFromSession
} = require('../controllers/jira.controller');

router.get('/config', getConfig);
router.post('/config', saveConfig);
router.post('/test-connection', testConnection);
router.post('/projects', getProjects);
router.post('/fields', getJiraFields);
router.post('/preview-jql', previewJql);
router.post('/sprints', getJiraSprints);
router.post('/sync', syncFromJira);

// Import via l'extension navigateur (session Jira). Payload volumineux : limite dédiée.
router.post('/import-session', express.json({ limit: '15mb' }), importFromSession);

module.exports = router;
