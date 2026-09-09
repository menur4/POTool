const Holiday = require('../models/Holiday');
const { seedHolidays, getHolidaysForDateRange } = require('../services/holiday.service');

// @desc    Obtenir les jours fériés
// @route   GET /api/holidays
// @access  Private
exports.getHolidays = async (req, res) => {
  try {
    const { year, country } = req.query;
    const filter = {};
    if (year) filter.year = parseInt(year);
    if (country) filter.country = country;

    const holidays = await Holiday.find(filter).sort({ date: 1 });

    res.status(200).json({
      success: true,
      count: holidays.length,
      data: holidays
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des jours fériés'
    });
  }
};

// @desc    Obtenir les jours fériés par plage de dates
// @route   GET /api/holidays/range
// @access  Private
exports.getHolidaysByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, countries } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Les dates de début et de fin sont requises'
      });
    }

    const countryList = countries ? countries.split(',') : ['FR', 'MA'];
    const holidays = await getHolidaysForDateRange(startDate, endDate, countryList);

    res.status(200).json({
      success: true,
      count: holidays.length,
      data: holidays
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des jours fériés'
    });
  }
};

// @desc    Créer un jour férié custom
// @route   POST /api/holidays
// @access  Private
exports.createHoliday = async (req, res) => {
  try {
    const { date, name, country } = req.body;
    const holidayDate = new Date(date);

    const holiday = await Holiday.create({
      date: holidayDate,
      name,
      country,
      isCustom: true,
      year: holidayDate.getFullYear()
    });

    res.status(201).json({
      success: true,
      data: holiday
    });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Un jour férié existe déjà à cette date pour ce pays'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du jour férié'
    });
  }
};

// @desc    Modifier un jour férié custom
// @route   PUT /api/holidays/:id
// @access  Private
exports.updateHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id);

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Jour férié non trouvé'
      });
    }

    if (!holiday.isCustom) {
      return res.status(400).json({
        success: false,
        message: 'Seuls les jours fériés personnalisés peuvent être modifiés'
      });
    }

    const updated = await Holiday.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du jour férié'
    });
  }
};

// @desc    Supprimer un jour férié custom
// @route   DELETE /api/holidays/:id
// @access  Private
exports.deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id);

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Jour férié non trouvé'
      });
    }

    if (!holiday.isCustom) {
      return res.status(400).json({
        success: false,
        message: 'Seuls les jours fériés personnalisés peuvent être supprimés'
      });
    }

    await holiday.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du jour férié'
    });
  }
};

// @desc    Pré-remplir les jours fériés pour une année
// @route   POST /api/holidays/seed
// @access  Private
exports.seedHolidays = async (req, res) => {
  try {
    const { year, countries } = req.body;

    if (!year) {
      return res.status(400).json({
        success: false,
        message: 'L\'année est requise'
      });
    }

    const countryList = countries || ['FR', 'MA'];
    const results = await seedHolidays(year, countryList);

    res.status(201).json({
      success: true,
      message: `${results.created} jour(s) férié(s) créé(s), ${results.skipped} ignoré(s)`,
      data: results
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du pré-remplissage des jours fériés'
    });
  }
};
