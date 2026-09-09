const Holiday = require('../models/Holiday');

/**
 * Calcule la date de Pâques pour une année donnée (algorithme de Meeus/Jones/Butcher)
 */
const getEasterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
};

/**
 * Retourne les jours fériés français pour une année
 */
const getFrenchHolidays = (year) => {
  const easter = getEasterDate(year);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);
  const whitMonday = new Date(easter);
  whitMonday.setDate(easter.getDate() + 50);

  return [
    { date: new Date(year, 0, 1), name: 'Jour de l\'An' },
    { date: easterMonday, name: 'Lundi de Pâques' },
    { date: new Date(year, 4, 1), name: 'Fête du Travail' },
    { date: new Date(year, 4, 8), name: 'Victoire 1945' },
    { date: ascension, name: 'Ascension' },
    { date: whitMonday, name: 'Lundi de Pentecôte' },
    { date: new Date(year, 6, 14), name: 'Fête Nationale' },
    { date: new Date(year, 7, 15), name: 'Assomption' },
    { date: new Date(year, 10, 1), name: 'Toussaint' },
    { date: new Date(year, 10, 11), name: 'Armistice 1918' },
    { date: new Date(year, 11, 25), name: 'Noël' }
  ];
};

/**
 * Table de lookup pour les fêtes islamiques (dates approximatives)
 * Ces dates varient selon l'observation du croissant lunaire
 */
const islamicHolidaysLookup = {
  2024: {
    eidAlFitr: [new Date(2024, 3, 10), new Date(2024, 3, 11)],
    eidAlAdha: [new Date(2024, 5, 17), new Date(2024, 5, 18)],
    mawlid: [new Date(2024, 8, 27)],
    hijriNewYear: [new Date(2024, 6, 8)]
  },
  2025: {
    eidAlFitr: [new Date(2025, 2, 31), new Date(2025, 3, 1)],
    eidAlAdha: [new Date(2025, 5, 7), new Date(2025, 5, 8)],
    mawlid: [new Date(2025, 8, 5)],
    hijriNewYear: [new Date(2025, 5, 27)]
  },
  2026: {
    eidAlFitr: [new Date(2026, 2, 20), new Date(2026, 2, 21)],
    eidAlAdha: [new Date(2026, 4, 27), new Date(2026, 4, 28)],
    mawlid: [new Date(2026, 7, 26)],
    hijriNewYear: [new Date(2026, 5, 16)]
  },
  2027: {
    eidAlFitr: [new Date(2027, 2, 10), new Date(2027, 2, 11)],
    eidAlAdha: [new Date(2027, 4, 16), new Date(2027, 4, 17)],
    mawlid: [new Date(2027, 7, 15)],
    hijriNewYear: [new Date(2027, 5, 7)]
  }
};

/**
 * Retourne les jours fériés marocains pour une année
 */
const getMoroccanHolidays = (year) => {
  const fixedHolidays = [
    { date: new Date(year, 0, 1), name: 'Jour de l\'An' },
    { date: new Date(year, 0, 11), name: 'Manifeste de l\'Indépendance' },
    { date: new Date(year, 0, 14), name: 'Nouvel An Amazigh (Yennayer)' },
    { date: new Date(year, 4, 1), name: 'Fête du Travail' },
    { date: new Date(year, 6, 30), name: 'Fête du Trône' },
    { date: new Date(year, 7, 14), name: 'Oued Ed-Dahab' },
    { date: new Date(year, 7, 20), name: 'Révolution du Roi et du Peuple' },
    { date: new Date(year, 7, 21), name: 'Fête de la Jeunesse' },
    { date: new Date(year, 10, 6), name: 'Marche Verte' },
    { date: new Date(year, 10, 18), name: 'Fête de l\'Indépendance' }
  ];

  // Ajouter les fêtes islamiques si disponibles
  const islamicDates = islamicHolidaysLookup[year];
  const islamicHolidays = [];
  if (islamicDates) {
    islamicDates.eidAlFitr.forEach(d => islamicHolidays.push({ date: d, name: 'Aïd Al-Fitr' }));
    islamicDates.eidAlAdha.forEach(d => islamicHolidays.push({ date: d, name: 'Aïd Al-Adha' }));
    islamicDates.mawlid.forEach(d => islamicHolidays.push({ date: d, name: 'Mawlid Ennabaoui' }));
    islamicDates.hijriNewYear.forEach(d => islamicHolidays.push({ date: d, name: '1er Moharram' }));
  }

  return [...fixedHolidays, ...islamicHolidays];
};

/**
 * Pré-remplit les jours fériés pour une année et des pays donnés
 */
const seedHolidays = async (year, countries = ['FR', 'MA']) => {
  const results = { created: 0, skipped: 0, errors: [] };

  for (const country of countries) {
    const holidays = country === 'FR' ? getFrenchHolidays(year) : getMoroccanHolidays(year);

    for (const holiday of holidays) {
      try {
        await Holiday.findOneAndUpdate(
          { date: holiday.date, country },
          {
            date: holiday.date,
            name: holiday.name,
            country,
            isCustom: false,
            year
          },
          { upsert: true, new: true }
        );
        results.created++;
      } catch (error) {
        if (error.code === 11000) {
          results.skipped++;
        } else {
          results.errors.push({ name: holiday.name, error: error.message });
        }
      }
    }
  }

  return results;
};

/**
 * Retourne les jours fériés entre deux dates
 */
const getHolidaysForDateRange = async (startDate, endDate, countries = ['FR', 'MA']) => {
  return Holiday.find({
    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    country: { $in: countries }
  }).sort({ date: 1 });
};

module.exports = {
  seedHolidays,
  getHolidaysForDateRange,
  getFrenchHolidays,
  getMoroccanHolidays,
  getEasterDate
};
