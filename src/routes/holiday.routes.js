const express = require('express');
const router = express.Router();
const {
  getHolidays,
  getHolidaysByDateRange,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  seedHolidays
} = require('../controllers/holiday.controller');

// Routes utilitaires (avant les routes paramétrées)
router.get('/range', getHolidaysByDateRange);
router.post('/seed', seedHolidays);

// Routes CRUD
router.route('/')
  .get(getHolidays)
  .post(createHoliday);

router.route('/:id')
  .put(updateHoliday)
  .delete(deleteHoliday);

module.exports = router;
