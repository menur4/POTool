const express = require('express');
const router = express.Router();
const {
  getStatusMappings,
  upsertStatusMapping,
  deleteStatusMapping,
  getKnownStatuses
} = require('../controllers/statusMapping.controller');

router.get('/known-statuses', getKnownStatuses);
router.route('/').get(getStatusMappings).post(upsertStatusMapping);
router.delete('/:id', deleteStatusMapping);

module.exports = router;
