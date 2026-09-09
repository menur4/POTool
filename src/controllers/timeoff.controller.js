const TimeOff = require('../models/TimeOff');
const TeamMember = require('../models/TeamMember');
const Sprint = require('../models/Sprint');
const { getWorkingDays } = require('../services/capacity.service');
const { getHolidaysForDateRange } = require('../services/holiday.service');

// Nombre de jours ouvrés (hors week-ends et jours fériés) sur l'intersection
// d'une période de congés et d'une fenêtre [windowStart, windowEnd].
function overlapWorkingDays(toStart, toEnd, windowStart, windowEnd, holidayDates) {
  const start = new Date(Math.max(new Date(toStart), new Date(windowStart)));
  const end = new Date(Math.min(new Date(toEnd), new Date(windowEnd)));
  if (end < start) return 0;
  return getWorkingDays(start, end, holidayDates);
}

// @desc    Lister les congés (option: filtre par plage de dates / membre)
// @route   GET /api/timeoff
exports.getTimeOff = async (req, res) => {
  try {
    const { from, to, member } = req.query;
    const filter = {};
    if (member) filter.member = member;
    if (from || to) {
      // Congés qui chevauchent la fenêtre demandée
      filter.startDate = to ? { $lte: new Date(to) } : filter.startDate;
      filter.endDate = from ? { $gte: new Date(from) } : filter.endDate;
    }
    const items = await TimeOff.find(filter)
      .populate('member', 'firstName lastName role photo')
      .sort({ startDate: 1 });
    res.json({ success: true, data: items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des congés' });
  }
};

// @desc    Créer un congé
// @route   POST /api/timeoff
exports.createTimeOff = async (req, res) => {
  try {
    const { member, startDate, endDate, reason } = req.body;
    if (!member || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'member, startDate et endDate sont requis' });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ success: false, message: 'La date de fin doit être postérieure à la date de début' });
    }
    const item = await TimeOff.create({ member, startDate, endDate, reason });
    const populated = await item.populate('member', 'firstName lastName role');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du congé' });
  }
};

// @desc    Modifier un congé (dates / motif)
// @route   PUT /api/timeoff/:id
exports.updateTimeOff = async (req, res) => {
  try {
    const { startDate, endDate, reason } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate et endDate sont requis' });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ success: false, message: 'La date de fin doit être postérieure à la date de début' });
    }
    const item = await TimeOff.findByIdAndUpdate(
      req.params.id,
      { startDate, endDate, reason },
      { new: true, runValidators: true }
    ).populate('member', 'firstName lastName role photo');
    if (!item) return res.status(404).json({ success: false, message: 'Congé non trouvé' });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors de la modification du congé' });
  }
};

// @desc    Supprimer un congé
// @route   DELETE /api/timeoff/:id
exports.deleteTimeOff = async (req, res) => {
  try {
    const item = await TimeOff.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Congé non trouvé' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression du congé' });
  }
};

// @desc    Jours d'absence par membre sur une période (pour pré-remplir un sprint)
// @route   GET /api/timeoff/days-off?startDate=...&endDate=...
exports.getDaysOffForRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate et endDate sont requis' });
    }
    const holidays = await getHolidaysForDateRange(startDate, endDate);
    const holidayDates = holidays.map(h => h.date || h);

    const timeoffs = await TimeOff.find({
      startDate: { $lte: new Date(endDate) },
      endDate: { $gte: new Date(startDate) }
    });

    const byMember = {};
    timeoffs.forEach(to => {
      const days = overlapWorkingDays(to.startDate, to.endDate, startDate, endDate, holidayDates);
      if (days > 0) {
        const id = to.member.toString();
        byMember[id] = (byMember[id] || 0) + days;
      }
    });

    res.json({ success: true, daysOff: byMember });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors du calcul des jours d\'absence' });
  }
};

// @desc    Stream de capacité : taux de disponibilité de l'équipe par sprint
// @route   GET /api/timeoff/capacity-stream
exports.getCapacityStream = async (req, res) => {
  try {
    const sprints = await Sprint.find({}, 'name startDate endDate status jiraId').sort({ startDate: 1 });
    const memberCount = await TeamMember.countDocuments();

    const result = [];
    for (const sprint of sprints) {
      if (!sprint.startDate || !sprint.endDate) continue;
      const holidays = await getHolidaysForDateRange(sprint.startDate, sprint.endDate);
      const holidayDates = holidays.map(h => h.date || h);
      const workingDays = getWorkingDays(sprint.startDate, sprint.endDate, holidayDates);

      // Total des jours de congés de l'équipe tombant dans le sprint
      const timeoffs = await TimeOff.find({
        startDate: { $lte: sprint.endDate },
        endDate: { $gte: sprint.startDate }
      });
      let totalDaysOff = 0;
      timeoffs.forEach(to => {
        totalDaysOff += overlapWorkingDays(to.startDate, to.endDate, sprint.startDate, sprint.endDate, holidayDates);
      });

      const capacity = memberCount * workingDays;
      const availabilityPercent = capacity > 0
        ? Math.round(Math.max(0, (capacity - totalDaysOff) / capacity) * 100)
        : 100;

      result.push({
        sprintId: sprint._id,
        name: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: sprint.status,
        workingDays,
        memberCount,
        totalDaysOff,
        availabilityPercent
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors du calcul du stream de capacité' });
  }
};
