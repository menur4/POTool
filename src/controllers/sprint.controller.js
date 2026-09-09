const Sprint = require('../models/Sprint');
const Epic = require('../models/Epic');
const JiraConfig = require('../models/JiraConfig');
const StatusMapping = require('../models/StatusMapping');
const { getHolidaysForDateRange } = require('../services/holiday.service');
const { calculatePlannedCapacity, calculateActualCapacity, estimateVelocity } = require('../services/capacity.service');
const { getProjectSprints, getAllIssues } = require('../services/jiraClient');
const { normalizeStatus } = require('../services/excelImport.service');

// Charge les mappings de statuts définis par l'utilisateur (jiraStatusLower -> internalStatus)
async function loadUserStatusMappings() {
  const mappings = await StatusMapping.find({});
  const map = {};
  mappings.forEach(m => { map[m.jiraStatus.toLowerCase().trim()] = m.internalStatus; });
  return map;
}

// Un item est "terminé" si son statut interne est 'done' OU si son statut Jira
// se normalise en 'done' selon les mappings définis par l'utilisateur.
// (mêmes critères que la normalisation à l'import / le calcul de capacité)
function isItemDone(item, userMappings) {
  if (item.status === 'done') return true;
  if (item.jiraStatus && normalizeStatus(item.jiraStatus, userMappings) === 'done') return true;
  return false;
}

// @desc    Obtenir tous les sprints
// @route   GET /api/sprints
// @access  Private
exports.getSprints = async (req, res) => {
  try {
    const { status, sort = '-startDate' } = req.query;

    // Construire le filtre
    const filter = {};
    if (status) {
      filter.status = status;
    }

    const sprints = await Sprint.find(filter)
      .populate('team.member', 'firstName lastName email role photo')
      .sort(sort);

    res.status(200).json({
      success: true,
      count: sprints.length,
      data: sprints
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des sprints'
    });
  }
};

// @desc    Obtenir un sprint par son ID
// @route   GET /api/sprints/:id
// @access  Private
exports.getSprint = async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id)
      .populate('team.member', 'firstName lastName email role dailyRate');

    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: sprint
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du sprint'
    });
  }
};

// @desc    Créer un nouveau sprint
// @route   POST /api/sprints
// @access  Private
exports.createSprint = async (req, res) => {
  try {
    // Utiliser les jours fériés passés par le client (exclusions comprises), ou les récupérer en DB
    // Note : holidays: [] signifie "tous exclus" (valide), undefined signifie "non fourni"
    let holidayDates;
    if (req.body.holidays !== undefined) {
      holidayDates = req.body.holidays;
    } else if (req.body.startDate && req.body.endDate) {
      const dbHolidays = await getHolidaysForDateRange(req.body.startDate, req.body.endDate);
      holidayDates = dbHolidays.map(h => h.date);
    } else {
      holidayDates = [];
    }

    // Calculer la capacité planifiée
    const capacityDetails = calculatePlannedCapacity(req.body, holidayDates);

    const sprintData = {
      ...req.body,
      capacity: {
        workingDays: capacityDetails.totalWorkingDays,
        planned: capacityDetails.netCapacity,
        actual: 0
      }
    };
    delete sprintData.holidays;

    const sprint = await Sprint.create(sprintData);

    // Recharger avec les références populées
    const populatedSprint = await Sprint.findById(sprint._id)
      .populate('team.member', 'firstName lastName email role');

    res.status(201).json({
      success: true,
      data: populatedSprint,
      capacityDetails
    });
  } catch (error) {
    console.error(error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du sprint'
    });
  }
};

// @desc    Mettre à jour un sprint
// @route   PUT /api/sprints/:id
// @access  Private
exports.updateSprint = async (req, res) => {
  try {
    let sprint = await Sprint.findById(req.params.id);

    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint non trouvé'
      });
    }

    // Empêcher la modification de certains champs sur un sprint actif ou fermé
    if (sprint.status !== 'draft') {
      const restrictedFields = ['startDate', 'endDate'];
      const attemptedRestrictedChanges = restrictedFields.filter(field => {
        if (req.body[field] === undefined) return false;
        // Comparer les dates en ignorant l'heure (YYYY-MM-DD)
        const existing = sprint[field] ? new Date(sprint[field]).toISOString().split('T')[0] : null;
        const incoming = req.body[field] ? new Date(req.body[field]).toISOString().split('T')[0] : null;
        return existing !== incoming;
      });

      if (attemptedRestrictedChanges.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Les champs suivants ne peuvent pas être modifiés sur un sprint ${sprint.status}: ${attemptedRestrictedChanges.join(', ')}`
        });
      }

      // Bloquer toute modification de team sur un sprint fermé
      if (sprint.status === 'closed' && req.body.team) {
        return res.status(400).json({
          success: false,
          message: 'L\'équipe ne peut pas être modifiée sur un sprint fermé'
        });
      }
    }

    // Recalculer la capacité si les dates ou l'équipe changent
    if (req.body.startDate || req.body.endDate || req.body.team || req.body.constraints) {
      const updatedSprintData = {
        startDate: req.body.startDate || sprint.startDate,
        endDate: req.body.endDate || sprint.endDate,
        team: req.body.team || sprint.team,
        constraints: req.body.constraints || sprint.constraints
      };

      let holidayDates;
      if (req.body.holidays !== undefined) {
        holidayDates = req.body.holidays;
      } else {
        const dbHolidays = await getHolidaysForDateRange(updatedSprintData.startDate, updatedSprintData.endDate);
        holidayDates = dbHolidays.map(h => h.date);
      }

      const capacityDetails = calculatePlannedCapacity(updatedSprintData, holidayDates);
      req.body.capacity = {
        ...sprint.capacity,
        workingDays: capacityDetails.totalWorkingDays,
        planned: capacityDetails.netCapacity
      };
    }
    delete req.body.holidays;

    sprint = await Sprint.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('team.member', 'firstName lastName email role');

    res.status(200).json({
      success: true,
      data: sprint
    });
  } catch (error) {
    console.error(error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du sprint'
    });
  }
};

// @desc    Supprimer un sprint
// @route   DELETE /api/sprints/:id
// @access  Private (Admin)
exports.deleteSprint = async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id);

    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint non trouvé'
      });
    }

    // Empêcher la suppression d'un sprint actif
    if (sprint.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer un sprint actif. Veuillez d\'abord le clôturer.'
      });
    }

    await sprint.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du sprint'
    });
  }
};

// @desc    Activer un sprint
// @route   POST /api/sprints/:id/activate
// @access  Private
exports.activateSprint = async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id);

    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint non trouvé'
      });
    }

    if (sprint.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Seul un sprint en brouillon peut être activé'
      });
    }

    // Vérifier qu'il n'y a pas d'autre sprint actif
    const activeSprint = await Sprint.findOne({ status: 'active' });
    if (activeSprint) {
      return res.status(400).json({
        success: false,
        message: `Un sprint est déjà actif: ${activeSprint.name}. Veuillez d'abord le clôturer.`
      });
    }

    sprint.status = 'active';
    await sprint.save();

    const populatedSprint = await Sprint.findById(sprint._id)
      .populate('team.member', 'firstName lastName email role');

    res.status(200).json({
      success: true,
      data: populatedSprint
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'activation du sprint'
    });
  }
};

// @desc    Obtenir les SP livrés d'un sprint (epics done)
// @route   GET /api/sprints/:id/delivered-sp
// @access  Private
exports.getDeliveredStoryPoints = async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id);

    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint non trouvé'
      });
    }

    // Items rattachés au sprint : soit au sprint INTERNE (champ `sprints`),
    // soit — si le sprint est lié à Jira — au SPRINT JIRA correspondant
    // (`jiraSprints.id`). On n'a donc pas besoin d'un rattachement interne
    // préalable pour remonter les SP livrés dès que le lien Jira existe.
    const orConds = [{ sprints: req.params.id }];
    if (sprint.jiraId != null) orConds.push({ 'jiraSprints.id': sprint.jiraId });

    const userMappings = await loadUserStatusMappings();
    const linkedItems = await Epic.find({ $or: orConds })
      .select('key title storyPoints status jiraStatus issueType completedDate').sort('key');

    // Filtrage sur les critères "terminé" définis par l'utilisateur
    // (statut interne 'done' OU jiraStatus normalisé en 'done').
    const doneEpics = linkedItems.filter(item => isItemDone(item, userMappings));
    const totalStoryPoints = doneEpics.reduce((sum, epic) => sum + (epic.storyPoints || 0), 0);
    const linkedTotal = linkedItems.length;

    // Décompte des user stories livrées (par type d'item, insensible à la casse)
    const isStory = (it) => /story|us|user\s*story/i.test(it.issueType || '');
    const deliveredStories = doneEpics.filter(isStory).length;

    res.status(200).json({
      success: true,
      data: {
        epics: doneEpics,
        totalStoryPoints,
        epicCount: doneEpics.length,      // nombre d'items livrés (tous types)
        deliveredStories,                 // nombre de user stories livrées
        linkedTotal,                      // nombre d'items rattachés (livrés ou non)
        source: sprint.jiraId != null ? 'jira' : 'internal'
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des SP livrés'
    });
  }
};

// Interroge Jira EN DIRECT pour un sprint lié et calcule le livré selon le mapping.
// Réutilisé par l'endpoint live (lecture) et la synchronisation persistante.
// @returns {Promise<{totalStoryPoints,epicCount,deliveredStories,linked}>}
async function computeDeliveredFromJira(sprint, config, userMappings) {
  const spField = (config && config.storyPointsField) || 'customfield_10016';
  const { issues } = await getAllIssues(
    config.instanceUrl, config.email, config.apiToken, `sprint = ${sprint.jiraId}`, ['status', 'issuetype', spField]
  );
  let totalStoryPoints = 0;
  let done = 0;
  let deliveredStories = 0;
  const isStory = (name) => /story|us|user\s*story/i.test(name || '');
  (issues || []).forEach((it) => {
    const f = it.fields || {};
    const statusName = f.status && f.status.name;
    const sp = Number(f[spField]) || 0;
    if (statusName && normalizeStatus(statusName, userMappings) === 'done') {
      done += 1;
      totalStoryPoints += sp;
      if (isStory(f.issuetype && f.issuetype.name)) deliveredStories += 1;
    }
  });
  return { totalStoryPoints, epicCount: done, deliveredStories, linked: (issues || []).length };
}

// @desc    Livré à date interrogé EN DIRECT depuis Jira (API Agile) pour un sprint lié.
//          Ne réimporte pas la base : requête JQL `sprint = <jiraId>`, filtrage sur
//          les critères "terminé" définis par l'utilisateur (mapping de statuts).
// @route   GET /api/sprints/:id/delivered-live
exports.getLiveDeliveredFromJira = async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) {
      return res.status(404).json({ success: false, message: 'Sprint non trouvé' });
    }
    if (sprint.jiraId == null) {
      return res.status(400).json({ success: false, message: 'Ce sprint n\'est pas lié à un sprint Jira.' });
    }
    const config = await JiraConfig.findOne();
    if (!config || !config.instanceUrl || !config.apiToken) {
      return res.status(400).json({ success: false, message: 'Configuration Jira absente.' });
    }

    const userMappings = await loadUserStatusMappings();
    const stats = await computeDeliveredFromJira(sprint, config, userMappings);

    res.status(200).json({
      success: true,
      data: {
        totalStoryPoints: stats.totalStoryPoints,
        epicCount: stats.epicCount,
        deliveredStories: stats.deliveredStories,
        linked: stats.linked,
        source: 'jira-live'
      }
    });
  } catch (error) {
    console.error(error);
    const msg = error?.message || 'Erreur lors de l\'interrogation de Jira';
    res.status(502).json({ success: false, message: `Jira: ${msg}` });
  }
};

// Applique le livré calculé sur un sprint et recalcule la vélocité si une
// capacité nette est disponible. Renvoie l'avant/après. Ne sauvegarde pas.
function applyDeliveredToSprint(sprint, stats) {
  const before = { deliveredStoryPoints: sprint.deliveredStoryPoints || 0, velocity: sprint.velocity?.actual || 0 };
  sprint.deliveredStoryPoints = stats.totalStoryPoints;
  const net = (sprint.capacity && (sprint.capacity.actual || sprint.capacity.planned)) || 0;
  let velocity = sprint.velocity?.actual || 0;
  if (net > 0) {
    velocity = Math.round((stats.totalStoryPoints / net) * 100) / 100;
    sprint.velocity = { ...(sprint.velocity ? sprint.velocity.toObject?.() || sprint.velocity : {}), actual: velocity };
  }
  return { before, after: { deliveredStoryPoints: stats.totalStoryPoints, velocity } };
}

// @desc    Synchronise (persiste) le livré d'UN sprint depuis Jira.
// @route   POST /api/sprints/:id/sync-delivered
exports.syncSprintDelivered = async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) return res.status(404).json({ success: false, message: 'Sprint non trouvé' });
    if (sprint.jiraId == null) return res.status(400).json({ success: false, message: 'Ce sprint n\'est pas lié à un sprint Jira.' });
    const config = await JiraConfig.findOne();
    if (!config || !config.instanceUrl || !config.apiToken) {
      return res.status(400).json({ success: false, message: 'Configuration Jira absente.' });
    }
    const userMappings = await loadUserStatusMappings();
    const stats = await computeDeliveredFromJira(sprint, config, userMappings);
    const diff = applyDeliveredToSprint(sprint, stats);
    await sprint.save();
    res.status(200).json({ success: true, data: { sprint: sprint.name, ...stats, ...diff } });
  } catch (error) {
    console.error(error);
    res.status(502).json({ success: false, message: `Jira: ${error?.message || 'échec de synchronisation'}` });
  }
};

// @desc    Backfill : synchronise le livré de TOUS les sprints clos liés à Jira.
// @route   POST /api/sprints/sync-delivered-all
exports.syncAllDelivered = async (req, res) => {
  try {
    const config = await JiraConfig.findOne();
    if (!config || !config.instanceUrl || !config.apiToken) {
      return res.status(400).json({ success: false, message: 'Configuration Jira absente.' });
    }
    const userMappings = await loadUserStatusMappings();
    const sprints = await Sprint.find({ status: 'closed', jiraId: { $ne: null } }).sort('startDate');
    const results = [];
    let updated = 0;
    for (const sprint of sprints) {
      try {
        const stats = await computeDeliveredFromJira(sprint, config, userMappings);
        const diff = applyDeliveredToSprint(sprint, stats);
        await sprint.save();
        updated += 1;
        results.push({ sprint: sprint.name, ok: true, delivered: stats.totalStoryPoints, stories: stats.deliveredStories, before: diff.before.deliveredStoryPoints });
      } catch (e) {
        results.push({ sprint: sprint.name, ok: false, error: e?.message });
      }
    }
    res.status(200).json({ success: true, data: { total: sprints.length, updated, results } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors du backfill du livré' });
  }
};

// @desc    Saisie/MàJ manuelle du livré et de la capacité nette d'un sprint (backfill Excel).
//          Recalcule la vélocité = SP livrés / capacité nette quand celle-ci est fournie.
// @route   PATCH /api/sprints/:id/delivered
exports.updateSprintDelivered = async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) return res.status(404).json({ success: false, message: 'Sprint non trouvé' });

    const { deliveredStoryPoints, netCapacity } = req.body;
    if (deliveredStoryPoints != null && deliveredStoryPoints !== '') {
      sprint.deliveredStoryPoints = Math.max(0, Number(deliveredStoryPoints) || 0);
    }
    if (netCapacity != null && netCapacity !== '') {
      const n = Math.max(0, Number(netCapacity) || 0);
      const cap = (sprint.capacity && (sprint.capacity.toObject ? sprint.capacity.toObject() : sprint.capacity)) || {};
      sprint.capacity = { ...cap, actual: n };
    }

    const net = (sprint.capacity && (sprint.capacity.actual || sprint.capacity.planned)) || 0;
    const sp = sprint.deliveredStoryPoints || 0;
    if (net > 0) {
      const vel = (sprint.velocity && (sprint.velocity.toObject ? sprint.velocity.toObject() : sprint.velocity)) || {};
      sprint.velocity = { ...vel, actual: Math.round((sp / net) * 100) / 100 };
    }

    await sprint.save();
    res.status(200).json({ success: true, data: sprint });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du livré' });
  }
};

// @desc    Clôturer un sprint
// @route   POST /api/sprints/:id/close
// @access  Private
exports.closeSprint = async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id);

    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint non trouvé'
      });
    }

    if (sprint.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Ce sprint est déjà clôturé'
      });
    }

    const { actualTeam, actualConstraints, deliveredStoryPoints, notes } = req.body;

    // Sauvegarder les données réelles sur le sprint
    if (actualTeam) {
      sprint.actualTeam = actualTeam;
    }
    if (actualConstraints) {
      sprint.actualConstraints = actualConstraints;
    }
    if (deliveredStoryPoints !== undefined) {
      sprint.deliveredStoryPoints = deliveredStoryPoints;
    }
    if (notes !== undefined) {
      sprint.notes = notes;
    }

    // Récupérer les jours fériés pour la plage du sprint
    const holidays = await getHolidaysForDateRange(sprint.startDate, sprint.endDate);
    const holidayDates = holidays.map(h => h.date);

    // Calculer la capacité réelle
    const actualCapacity = calculateActualCapacity(sprint, {
      team: actualTeam || sprint.team,
      constraints: actualConstraints || sprint.constraints,
      holidays: holidayDates
    });

    sprint.capacity.actual = actualCapacity.netCapacity;

    // Calculer la vélocité réelle : SP livrés / capacité nette réelle (SP/jour)
    const spDelivered = deliveredStoryPoints ?? sprint.deliveredStoryPoints ?? 0;
    if (actualCapacity.netCapacity > 0) {
      sprint.velocity.actual = Math.round((spDelivered / actualCapacity.netCapacity) * 100) / 100;
    } else {
      sprint.velocity.actual = 0;
    }

    sprint.status = 'closed';
    await sprint.save();

    const populatedSprint = await Sprint.findById(sprint._id)
      .populate('team.member', 'firstName lastName email role')
      .populate('actualTeam.member', 'firstName lastName email role');

    res.status(200).json({
      success: true,
      data: populatedSprint,
      capacityDetails: {
        planned: calculatePlannedCapacity(sprint, holidayDates),
        actual: actualCapacity
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la clôture du sprint'
    });
  }
};

// @desc    Rouvrir un sprint clôturé (le remet en brouillon, disponible)
// @route   POST /api/sprints/:id/reopen
// @access  Private
exports.reopenSprint = async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id);

    if (!sprint) {
      return res.status(404).json({ success: false, message: 'Sprint non trouvé' });
    }
    if (sprint.status !== 'closed') {
      return res.status(400).json({ success: false, message: 'Seul un sprint clôturé peut être rouvert' });
    }

    // Remis en brouillon : à nouveau disponible et éditable. Les données de
    // clôture (capacité/vélocité réelles) sont conservées et seront recalculées
    // si le sprint est de nouveau clôturé.
    sprint.status = 'draft';
    await sprint.save();

    const populatedSprint = await Sprint.findById(sprint._id)
      .populate('team.member', 'firstName lastName email role');

    res.status(200).json({ success: true, data: populatedSprint });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors de la réouverture du sprint' });
  }
};

// @desc    Supprimer tous les epics d'un sprint (pour réimport)
// @route   DELETE /api/sprints/:id/epics
// @access  Private
exports.clearSprintEpics = async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id);

    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint non trouvé'
      });
    }

    // Trouver tous les epics liés à ce sprint
    const epics = await Epic.find({ sprints: req.params.id });

    let removed = 0;
    let unlinked = 0;

    for (const epic of epics) {
      if (epic.sprints.length <= 1) {
        // Epic uniquement dans ce sprint → supprimer
        await epic.deleteOne();
        removed++;
      } else {
        // Epic partagé entre plusieurs sprints → juste délier
        epic.sprints = epic.sprints.filter(s => s.toString() !== req.params.id);
        await epic.save();
        unlinked++;
      }
    }

    // Remettre la vélocité planifiée à 0
    sprint.velocity = sprint.velocity || {};
    sprint.velocity.planned = 0;
    await sprint.save();

    res.status(200).json({
      success: true,
      data: {
        removed,
        unlinked,
        total: removed + unlinked
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression des données du sprint'
    });
  }
};

// @desc    Calculer la capacité d'un sprint
// @route   POST /api/sprints/calculate-capacity
// @access  Private
exports.calculateCapacity = async (req, res) => {
  try {
    const { startDate, endDate, team, constraints, holidays } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Les dates de début et de fin sont requises'
      });
    }

    // Auto-fetch les jours fériés si non fournis
    let holidayDates = holidays || [];
    if (holidayDates.length === 0) {
      const dbHolidays = await getHolidaysForDateRange(startDate, endDate);
      holidayDates = dbHolidays.map(h => h.date);
    }

    const sprintData = { startDate, endDate, team: team || [], constraints: constraints || {} };
    const capacityDetails = calculatePlannedCapacity(sprintData, holidayDates);

    res.status(200).json({
      success: true,
      data: capacityDetails,
      holidays: holidayDates
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du calcul de la capacité'
    });
  }
};

// @desc    Obtenir l'estimation de vélocité basée sur l'historique
// @route   GET /api/sprints/velocity-estimate
// @access  Private
exports.getVelocityEstimate = async (req, res) => {
  try {
    const { sprintsToConsider = 3 } = req.query;

    const pastSprints = await Sprint.find({ status: 'closed' })
      .sort('-endDate')
      .limit(parseInt(sprintsToConsider) * 2); // Récupérer plus pour avoir de la marge

    const velocityEstimate = estimateVelocity(pastSprints, parseInt(sprintsToConsider));

    res.status(200).json({
      success: true,
      data: velocityEstimate
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du calcul de l\'estimation de vélocité'
    });
  }
};

// Lie tous les tickets référençant un sprint Jira (jiraSprints.id) au sprint interne.
async function linkTicketsToSprint(sprintObjectId, jiraId) {
  const result = await Epic.updateMany(
    { 'jiraSprints.id': jiraId },
    { $addToSet: { sprints: sprintObjectId } }
  );
  return result.modifiedCount || 0;
}

// @desc    Vue de réconciliation : sprints Jira (vus sur les tickets) vs sprints internes
// @route   GET /api/sprints/jira-reconciliation
exports.getJiraReconciliation = async (req, res) => {
  try {
    // 1) Sprints Jira distincts rencontrés sur les tickets importés (avec nb de tickets)
    const ticketSprints = await Epic.aggregate([
      { $unwind: '$jiraSprints' },
      { $group: {
          _id: '$jiraSprints.id',
          name: { $first: '$jiraSprints.name' },
          state: { $first: '$jiraSprints.state' },
          startDate: { $first: '$jiraSprints.startDate' },
          endDate: { $first: '$jiraSprints.endDate' },
          ticketCount: { $sum: 1 }
      }}
    ]);

    // 2) Vrais sprints Jira via l'API Agile (inclut ceux sans ticket : futurs/vides)
    let realSprints = [];
    let jiraError = null;
    try {
      const config = await JiraConfig.findOne();
      if (config && config.instanceUrl && config.apiToken && config.projectKey) {
        realSprints = await getProjectSprints(config.instanceUrl, config.email, config.apiToken, config.projectKey);
      }
    } catch (e) {
      jiraError = e.message; // Jira indisponible → on continue avec les sprints des tickets
    }

    // Fusion par id Jira (les tickets apportent ticketCount ; l'API Agile la liste complète)
    const merged = new Map();
    ticketSprints.forEach(js => {
      if (js._id == null) return;
      merged.set(js._id, {
        jiraId: js._id, name: js.name, state: js.state,
        startDate: js.startDate || null, endDate: js.endDate || null,
        ticketCount: js.ticketCount
      });
    });
    realSprints.forEach(s => {
      const prev = merged.get(s.id);
      merged.set(s.id, {
        jiraId: s.id,
        name: s.name || (prev && prev.name),
        state: s.state || (prev && prev.state),
        startDate: s.startDate || (prev && prev.startDate) || null,
        endDate: s.endDate || (prev && prev.endDate) || null,
        ticketCount: (prev && prev.ticketCount) || 0
      });
    });

    // Index des sprints internes par jiraId et par nom
    const sprints = await Sprint.find({}, 'name jiraId').lean();
    const byJiraId = new Map();
    const byName = new Map();
    sprints.forEach(s => {
      if (s.jiraId != null) byJiraId.set(s.jiraId, s);
      byName.set((s.name || '').trim().toLowerCase(), s);
    });

    const items = Array.from(merged.values())
      .filter(js => js.jiraId != null)
      .map(js => {
        const linked = byJiraId.get(js.jiraId);
        let status = 'missing';
        let internalSprint = null;
        let suggestion = null;

        if (linked) {
          status = 'linked';
          internalSprint = { _id: linked._id, name: linked.name };
        } else {
          const named = byName.get((js.name || '').trim().toLowerCase());
          if (named && named.jiraId == null) {
            status = 'suggested';
            suggestion = { _id: named._id, name: named.name };
          }
        }

        return {
          jiraId: js.jiraId,
          name: js.name,
          state: js.state,
          startDate: js.startDate || null,
          endDate: js.endDate || null,
          ticketCount: js.ticketCount,
          status,
          internalSprint,
          suggestion
        };
      })
      .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));

    res.json({ success: true, items, jiraError });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors de la réconciliation Jira' });
  }
};

// @desc    Créer un sprint interne depuis un sprint Jira et lier ses tickets
// @route   POST /api/sprints/from-jira
exports.createSprintFromJira = async (req, res) => {
  try {
    const { jiraId, name, startDate, endDate } = req.body;
    if (jiraId == null || !name) {
      return res.status(400).json({ success: false, message: 'jiraId et name sont requis' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Ce sprint Jira n\'a pas de dates de début/fin ; création impossible.' });
    }

    const existing = await Sprint.findOne({ jiraId });
    if (existing) {
      return res.status(409).json({ success: false, message: `Un sprint interne est déjà lié à ce sprint Jira (${existing.name}).` });
    }

    const sprint = await Sprint.create({
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      jiraId,
      status: 'draft'
    });

    const linkedCount = await linkTicketsToSprint(sprint._id, jiraId);
    res.status(201).json({ success: true, data: sprint, linkedCount });
  } catch (error) {
    console.error(error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(v => v.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: 'Erreur lors de la création du sprint depuis Jira' });
  }
};

// @desc    Lier un sprint interne existant à un sprint Jira et lier ses tickets
// @route   POST /api/sprints/link-jira
exports.linkSprintToJira = async (req, res) => {
  try {
    const { sprintId, jiraId } = req.body;
    if (!sprintId || jiraId == null) {
      return res.status(400).json({ success: false, message: 'sprintId et jiraId sont requis' });
    }

    const conflict = await Sprint.findOne({ jiraId, _id: { $ne: sprintId } });
    if (conflict) {
      return res.status(409).json({ success: false, message: `Ce sprint Jira est déjà lié à « ${conflict.name} ».` });
    }

    const sprint = await Sprint.findByIdAndUpdate(sprintId, { jiraId }, { new: true });
    if (!sprint) {
      return res.status(404).json({ success: false, message: 'Sprint interne non trouvé' });
    }

    const linkedCount = await linkTicketsToSprint(sprint._id, jiraId);
    res.json({ success: true, data: sprint, linkedCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors de la liaison du sprint à Jira' });
  }
};

// Incrémente le numéro en fin de nom : "Sprint 73" -> "Sprint 74"
function bumpSprintName(name) {
  const m = (name || '').match(/(\d+)\s*$/);
  if (m) return name.slice(0, m.index) + (parseInt(m[1], 10) + 1);
  return `${name || 'Sprint'} 1`;
}

function addUTCDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

// @desc    Générer les prochains sprints (cadence 2 semaines, vendredi -> jeudi)
// @route   POST /api/sprints/generate-next
// Body: { untilDate?: ISO, count?: number }  (idempotent : repart du dernier sprint)
exports.generateNextSprints = async (req, res) => {
  try {
    const { untilDate, count } = req.body || {};
    const until = untilDate ? new Date(untilDate) : null;
    const maxCount = count ? parseInt(count, 10) : null;

    const last = await Sprint.findOne().sort({ startDate: -1 });

    let name;
    let start;
    if (last && last.endDate) {
      name = last.name;
      start = addUTCDays(last.endDate, 1); // lendemain de la fin = vendredi
    } else {
      // Aucun sprint : démarrer au prochain vendredi
      name = 'Sprint 0';
      const today = new Date();
      const dow = today.getUTCDay(); // 5 = vendredi
      start = addUTCDays(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()), (5 - dow + 7) % 7);
    }

    const created = [];
    const SAFETY = 200;
    for (let i = 0; i < SAFETY; i++) {
      if (until && start > until) break;
      if (maxCount && created.length >= maxCount) break;
      if (!until && !maxCount && created.length >= 6) break; // défaut

      name = bumpSprintName(name);
      const end = addUTCDays(start, 13); // 2 semaines, vendredi -> jeudi

      const exists = await Sprint.findOne({ startDate: start });
      if (!exists) {
        const sprint = await Sprint.create({
          name,
          startDate: new Date(start),
          endDate: end,
          status: 'draft'
        });
        created.push(sprint);
      }

      start = addUTCDays(end, 1); // prochain vendredi
    }

    res.json({ success: true, created: created.length, sprints: created });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors de la génération des sprints' });
  }
};
