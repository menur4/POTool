const express = require('express');
const router = express.Router();
const {
  getTimeOff,
  createTimeOff,
  updateTimeOff,
  deleteTimeOff,
  getDaysOffForRange,
  getCapacityStream
} = require('../controllers/timeoff.controller');

// Routes utilitaires (avant /:id)
router.get('/days-off', getDaysOffForRange);
router.get('/capacity-stream', getCapacityStream);

router.route('/')
  .get(getTimeOff)
  .post(createTimeOff);

router.put('/:id', updateTimeOff);
router.delete('/:id', deleteTimeOff);

module.exports = router;
