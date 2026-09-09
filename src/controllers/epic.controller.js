const mongoose = require('mongoose');
const Epic = require('../models/Epic');
const Sprint = require('../models/Sprint');
const StatusMapping = require('../models/StatusMapping');
const JiraConfig = require('../models/JiraConfig');
const { importFromExcel, validateAndPreview } = require('../services/excelImport.service');
const { updateIssueLabels } = require('../services/jiraClient');

// Convertit un label d'entité en label Jira valide (pas d'espaces).
function toJiraLabel(l) {
  return String((l && l.name) != null ? l.name : l).trim().replace(/\s+/g, '_');
}

// Synchronise les labels d'entité d'un ticket vers Jira (ajout/retrait incrémental).
// Best-effort : renvoie un message d'avertissement en cas d'échec, ne jette pas.
async function syncEntityLabelsToJira(oldLabels, newLabels, issueKey) {
  const config = await JiraConfig.findOne();
  if (!config || !config.instanceUrl || !config.apiToken) {
    return 'Configuration Jira absente : labels non synchronisés vers Jira.';
  }
  const oldSet = new Set((oldLabels || []).map(toJiraLabel).filter(Boolean));
  const newSet = new Set((newLabels || []).map(toJiraLabel).filter(Boolean));
  const add = [...newSet].filter(x => !oldSet.has(x));
  const remove = [...oldSet].filter(x => !newSet.has(x));
  if (!add.length && !remove.length) return undefined;

  try {
    await updateIssueLabels(config.instanceUrl, config.email, config.apiToken, issueKey, { add, remove });
    return undefined;
  } catch (e) {
    return `Mise à jour des labels Jira échouée (${issueKey}) : ${e.message}`;
  }
}

// Échappe les caractères spéciaux regex.
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Parse le paramètre issueType (valeur unique ou liste séparée par des virgules).
function parseIssueTypes(issueType) {
  return issueType ? String(issueType).split(',').map(s => s.trim()).filter(Boolean) : [];
}

// Construit la clause de filtre Mongo pour un ou plusieurs types (insensible à la casse).
function buildIssueTypeFilter(types) {
  if (types.length === 1) return { $regex: new RegExp(`^${escapeRegex(types[0])}$`, 'i') };
  return { $in: types.map(t => new RegExp(`^${escapeRegex(t)}$`, 'i')) };
}

// @desc    Obtenir tous les epics
// @route   GET /api/epics
// @access  Private
exports.getEpics = async (req, res) => {
  try {
    const {
      status,
      sprint,
      category,
      priority,
      issueType,
      entityLabel,
      search,
      year,
      quarter,
      sort = '-updatedAt',
      page = 1,
      limit = 200
    } = req.query;

    // Construire le filtre
    const filter = {};
    if (status) filter.status = status;
    if (sprint) {
      const ids = sprint.split(',').map(id => id.trim()).filter(Boolean);
      filter.sprints = ids.length === 1 ? ids[0] : { $in: ids };
    }
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    const issueTypes = parseIssueTypes(issueType);
    if (issueTypes.length) filter.issueType = buildIssueTypeFilter(issueTypes);
    if (entityLabel === '__none__') {
      filter.$or = [
        { entityLabels: { $exists: false } },
        { entityLabels: { $size: 0 } }
      ];
    } else if (entityLabel) {
      filter['entityLabels.name'] = entityLabel;
    }

    // Filtre par année et trimestre (basé sur les dates des sprints)
    if (year || quarter) {
      let startDate, endDate;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      if (quarter) {
        const quarterNum = parseInt(quarter);
        const startMonth = (quarterNum - 1) * 3;
        startDate = new Date(yearNum, startMonth, 1);
        endDate = new Date(yearNum, startMonth + 3, 0, 23, 59, 59);
      } else if (year) {
        startDate = new Date(yearNum, 0, 1);
        endDate = new Date(yearNum, 11, 31, 23, 59, 59);
      }

      if (startDate && endDate) {
        // Trouver les sprints qui chevauchent la période
        const sprintsInPeriod = await Sprint.find({
          $or: [
            { startDate: { $gte: startDate, $lte: endDate } },
            { endDate: { $gte: startDate, $lte: endDate } },
            { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
          ]
        }).select('_id');

        const sprintIds = sprintsInPeriod.map(s => s._id);
        if (sprintIds.length > 0) {
          filter.sprints = { $in: sprintIds };
        } else {
          // Aucun sprint trouvé pour cette période
          filter.sprints = { $size: 0 };
        }
      }
    }

    // Recherche textuelle
    if (search) {
      filter.$or = [
        { key: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Si on filtre uniquement par Epic, utiliser l'agrégation pour calculer les SP des enfants.
    // (les sélections multiples utilisent la liste simple ci-dessous)
    if (issueTypes.length === 1 && issueTypes[0].toLowerCase() === 'epic') {
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: 'epics',
            let: { epicKey: '$key' },
            pipeline: [
              { $match: { $expr: { $eq: ['$parentKey', '$$epicKey'] } } },
              {
                $group: {
                  _id: null,
                  totalSP: { $sum: '$storyPoints' },
                  deliveredSP: {
                    $sum: {
                      $cond: [{ $eq: ['$status', 'done'] }, '$storyPoints', 0]
                    }
                  },
                  childrenCount: { $sum: 1 }
                }
              }
            ],
            as: 'childrenStats'
          }
        },
        {
          $lookup: {
            from: 'epics',
            let: { epicKey: '$key' },
            pipeline: [
              { $match: { $expr: { $eq: ['$parentKey', '$$epicKey'] } } },
              { $unwind: { path: '$sprints', preserveNullAndEmptyArrays: false } },
              {
                $group: {
                  _id: '$sprints',
                  totalSP: { $sum: '$storyPoints' },
                  deliveredSP: {
                    $sum: {
                      $cond: [{ $eq: ['$status', 'done'] }, '$storyPoints', 0]
                    }
                  }
                }
              }
            ],
            as: 'sprintStats'
          }
        },
        {
          $addFields: {
            childrenTotalSP: { $ifNull: [{ $arrayElemAt: ['$childrenStats.totalSP', 0] }, 0] },
            childrenDeliveredSP: { $ifNull: [{ $arrayElemAt: ['$childrenStats.deliveredSP', 0] }, 0] },
            childrenCount: { $ifNull: [{ $arrayElemAt: ['$childrenStats.childrenCount', 0] }, 0] }
          }
        },
        { $unset: 'childrenStats' },
        { $sort: { updatedAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
      ];

      const [epics, totalResult] = await Promise.all([
        Epic.aggregate(pipeline),
        Epic.countDocuments(filter)
      ]);

      // Populate sprint après l'agrégation
      await Epic.populate(epics, [
        { path: 'sprints', select: 'name status startDate endDate' },
        { path: 'assignee', select: 'firstName lastName' }
      ]);

      return res.status(200).json({
        success: true,
        count: epics.length,
        total: totalResult,
        page: parseInt(page),
        pages: Math.ceil(totalResult / parseInt(limit)),
        data: epics
      });
    }

    // Sinon, requête classique
    const [epics, total] = await Promise.all([
      Epic.find(filter)
        .populate('sprints', 'name status startDate endDate')
        .populate('assignee', 'firstName lastName')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Epic.countDocuments(filter)
    ]);

    // Roll-up des SP des enfants sur les lignes Epic (les SP Jira sont portés
    // par les stories, pas par les epics) — calculé sur l'ensemble des enfants.
    const epicKeys = epics
      .filter(e => (e.issueType || '').toLowerCase() === 'epic')
      .map(e => e.key);
    if (epicKeys.length) {
      const rollups = await Epic.aggregate([
        { $match: { parentKey: { $in: epicKeys } } },
        { $group: {
            _id: '$parentKey',
            childrenTotalSP: { $sum: '$storyPoints' },
            childrenDeliveredSP: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, '$storyPoints', 0] } },
            childrenCount: { $sum: 1 }
        }}
      ]);
      const byKey = new Map(rollups.map(r => [r._id, r]));
      epics.forEach(e => {
        if ((e.issueType || '').toLowerCase() === 'epic') {
          const r = byKey.get(e.key);
          e.childrenTotalSP = r ? r.childrenTotalSP : 0;
          e.childrenDeliveredSP = r ? r.childrenDeliveredSP : 0;
          e.childrenCount = r ? r.childrenCount : 0;
        }
      });
    }

    res.status(200).json({
      success: true,
      count: epics.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: epics
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des epics'
    });
  }
};

// @desc    Obtenir un epic par son ID
// @route   GET /api/epics/:id
// @access  Private
exports.getEpic = async (req, res) => {
  try {
    const epic = await Epic.findById(req.params.id)
      .populate('sprints', 'name status startDate endDate')
      .populate('assignee', 'firstName lastName email');

    if (!epic) {
      return res.status(404).json({
        success: false,
        message: 'Epic non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: epic
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'epic'
    });
  }
};

// @desc    Créer un nouveau epic
// @route   POST /api/epics
// @access  Private
exports.createEpic = async (req, res) => {
  try {
    const epic = await Epic.create({
      ...req.body,
      importSource: 'manual'
    });

    res.status(201).json({
      success: true,
      data: epic
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

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Un epic avec cette clé existe déjà'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'epic'
    });
  }
};

// @desc    Mettre à jour un epic
// @route   PUT /api/epics/:id
// @access  Private
exports.updateEpic = async (req, res) => {
  try {
    // État avant modification (pour calculer le diff des labels d'entité)
    const before = await Epic.findById(req.params.id).select('entityLabels');

    const epic = await Epic.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('sprints', 'name status startDate endDate')
      .populate('assignee', 'firstName lastName');

    if (!epic) {
      return res.status(404).json({
        success: false,
        message: 'Epic non trouvé'
      });
    }

    // Si l'épic est de type "Epic" et que ses entityLabels ont changé,
    // propager vers ses US enfants qui n'ont pas encore d'entité
    const isEpic = epic.issueType?.toLowerCase() === 'epic';
    if (isEpic && req.body.entityLabels && epic.entityLabels?.length > 0) {
      await Epic.updateMany(
        {
          parentKey: epic.key,
          $or: [{ entityLabels: { $exists: false } }, { entityLabels: { $size: 0 } }]
        },
        { entityLabels: epic.entityLabels }
      );
    }

    // Propager les labels d'entité vers Jira (uniquement les tickets issus de Jira).
    let jiraWarning;
    if (req.body.entityLabels !== undefined && epic.jiraId && epic.key) {
      jiraWarning = await syncEntityLabelsToJira(before?.entityLabels, epic.entityLabels, epic.key);
    }

    res.status(200).json({
      success: true,
      data: epic,
      ...(jiraWarning ? { jiraWarning } : {})
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

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Un epic avec cette clé existe déjà'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'epic'
    });
  }
};

// @desc    Supprimer un epic
// @route   DELETE /api/epics/:id
// @access  Private
exports.deleteEpic = async (req, res) => {
  try {
    const epic = await Epic.findById(req.params.id);

    if (!epic) {
      return res.status(404).json({
        success: false,
        message: 'Epic non trouvé'
      });
    }

    await epic.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'epic'
    });
  }
};

// @desc    Supprimer plusieurs epics
// @route   DELETE /api/epics/bulk
// @access  Private
exports.deleteEpics = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir une liste d\'IDs à supprimer'
      });
    }

    const result = await Epic.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      success: true,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression des epics'
    });
  }
};

// @desc    Prévisualiser un import Excel
// @route   POST /api/epics/import/preview
// @access  Private
exports.previewImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un fichier Excel'
      });
    }

    const options = {
      sheetName: req.body.sheetName,
      headerRow: parseInt(req.body.headerRow) || 1,
      defaultCategory: req.body.defaultCategory
    };

    const userMappingDocs = await StatusMapping.find();
    const userMappings = {};
    userMappingDocs.forEach(m => {
      userMappings[m.jiraStatus.toLowerCase()] = m.internalStatus;
    });

    const result = validateAndPreview(req.file.buffer, options, userMappings);
    const meta = result.metadata || {};

    res.status(200).json({
      success: true,
      preview: result.preview,
      errors: result.errors,
      totalRows: meta.totalRows,
      importedCount: meta.importedCount,
      totalStoryPoints: meta.totalStoryPoints || 0,
      spColumnDetected: meta.detectedMapping?.storyPoints !== undefined,
      detectedColumns: meta.headers
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erreur lors de la prévisualisation du fichier'
    });
  }
};

// @desc    Importer des epics depuis Excel
// @route   POST /api/epics/import
// @access  Private
exports.importEpics = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un fichier Excel'
      });
    }

    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Le fichier est vide'
      });
    }

    const options = {
      sheetName: req.body.sheetName,
      headerRow: parseInt(req.body.headerRow) || 1,
      defaultCategory: req.body.defaultCategory,
      skipDuplicates: req.body.skipDuplicates !== 'false'
    };

    // Sprint à assigner (optionnel)
    const sprintId = req.body.sprint || null;

    // Si un sprint est spécifié, vider ses epics existants avant l'import (remplacement systématique)
    if (sprintId) {
      const existingEpics = await Epic.find({ sprints: sprintId });
      for (const epic of existingEpics) {
        if (epic.sprints.length <= 1) {
          await epic.deleteOne();
        } else {
          epic.sprints = epic.sprints.filter(s => s.toString() !== sprintId.toString());
          await epic.save();
        }
      }
      await Sprint.findByIdAndUpdate(sprintId, { 'velocity.planned': 0 });
    }

    // Charger les mappings utilisateur pour la normalisation des statuts
    const userMappingDocs = await StatusMapping.find();
    const userMappings = {};
    userMappingDocs.forEach(m => {
      userMappings[m.jiraStatus.toLowerCase()] = m.internalStatus;
    });

    // Parser le fichier
    let importResult;
    try {
      importResult = importFromExcel(req.file.buffer, options, userMappings);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: `Erreur de parsing: ${parseError.message}`
      });
    }

    if (!importResult.success || importResult.epics.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun epic valide trouvé dans le fichier',
        errors: importResult.errors
      });
    }

    // Insérer les epics en base
    const insertedEpics = [];
    const insertErrors = [];

    for (const epicData of importResult.epics) {
      try {
        // Préparer le tableau sprints
        if (sprintId) {
          epicData.sprints = [sprintId];
        } else {
          epicData.sprints = [];
        }

        // Vérifier si l'epic existe déjà par sa clé
        const existingEpic = await Epic.findOne({ key: epicData.key });

        if (existingEpic) {
          if (options.skipDuplicates) {
            // Mettre à jour le issueType si l'item est détecté comme Epic
            if (epicData.issueType === 'Epic' && existingEpic.issueType !== 'Epic') {
              existingEpic.issueType = 'Epic';
            }
            // Ajouter le sprint au tableau (sans doublon)
            if (sprintId) {
              const sprintStr = sprintId.toString();
              const alreadyHas = existingEpic.sprints.some(s => s.toString() === sprintStr);
              if (!alreadyHas) {
                existingEpic.sprints.push(sprintId);
              }
            }
            // Mettre à jour les story points et le statut
            if (epicData.storyPoints > 0) {
              existingEpic.storyPoints = epicData.storyPoints;
            }
            if (epicData.status && epicData.status !== 'backlog') {
              existingEpic.status = epicData.status;
            }
            await existingEpic.save();
            insertErrors.push({
              key: epicData.key,
              error: 'Epic existant mis à jour'
            });
            continue;
          }
          // Mode non-skip : écraser + ajouter sprint
          const existingSprints = existingEpic.sprints || [];
          Object.assign(existingEpic, epicData);
          // Fusionner les sprints existants avec le nouveau
          const allSprintIds = new Set([...existingSprints.map(s => s.toString()), ...(epicData.sprints || []).map(s => s.toString())]);
          existingEpic.sprints = [...allSprintIds];
          await existingEpic.save();
          insertedEpics.push(existingEpic);
        } else {
          const epic = await Epic.create(epicData);
          insertedEpics.push(epic);
        }
      } catch (e) {
        insertErrors.push({
          key: epicData.key,
          error: e.message
        });
      }
    }

    // Propager les entityLabels des épics parents vers leurs user stories
    const allImportedKeys = importResult.epics.map(e => e.key);
    const childrenInImport = await Epic.find({
      key: { $in: allImportedKeys },
      parentKey: { $exists: true, $ne: null, $ne: '' }
    }).select('_id parentKey entityLabels');

    if (childrenInImport.length > 0) {
      const uniqueParentKeys = [...new Set(childrenInImport.map(c => c.parentKey))];
      const parentEpics = await Epic.find(
        { key: { $in: uniqueParentKeys }, 'entityLabels.0': { $exists: true } }
      ).select('key entityLabels');

      const parentEntityMap = {};
      parentEpics.forEach(p => { parentEntityMap[p.key] = p.entityLabels; });

      const toUpdate = childrenInImport.filter(
        c => parentEntityMap[c.parentKey] && (!c.entityLabels || c.entityLabels.length === 0)
      );
      if (toUpdate.length > 0) {
        await Promise.all(toUpdate.map(c =>
          Epic.findByIdAndUpdate(c._id, { entityLabels: parentEntityMap[c.parentKey] })
        ));
      }
    }

    // Mettre à jour la vélocité du sprint avec le total des story points
    if (sprintId) {
      const sprint = await Sprint.findById(sprintId);

      const totalStoryPoints = await Epic.aggregate([
        { $match: { sprints: new mongoose.Types.ObjectId(sprintId) } },
        { $group: { _id: null, total: { $sum: '$storyPoints' } } }
      ]);
      const plannedVelocity = totalStoryPoints[0]?.total || 0;

      const updateData = { 'velocity.planned': plannedVelocity };

      // Si le sprint est clôturé, recalculer aussi les SP livrés et la vélocité réelle
      if (sprint && sprint.status === 'closed') {
        const doneStoryPoints = await Epic.aggregate([
          { $match: { sprints: new mongoose.Types.ObjectId(sprintId), status: 'done' } },
          { $group: { _id: null, total: { $sum: '$storyPoints' } } }
        ]);
        const deliveredSP = doneStoryPoints[0]?.total || 0;
        updateData.deliveredStoryPoints = deliveredSP;

        const actualCapacity = sprint.capacity?.actual || 0;
        if (actualCapacity > 0) {
          updateData['velocity.actual'] = Math.round((deliveredSP / actualCapacity) * 100) / 100;
        }
      }

      await Sprint.findByIdAndUpdate(sprintId, updateData);
    }

    res.status(201).json({
      success: true,
      message: `${insertedEpics.length} epic(s) importé(s) avec succès`,
      data: {
        imported: insertedEpics.length,
        errors: insertErrors.length,
        total: importResult.epics.length,
        totalStoryPoints: importResult.metadata?.totalStoryPoints || 0
      },
      errors: insertErrors.length > 0 ? insertErrors : undefined
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erreur lors de l\'import du fichier'
    });
  }
};

// @desc    Assigner un epic à un sprint
// @route   PUT /api/epics/:id/assign-sprint
// @access  Private
exports.assignToSprint = async (req, res) => {
  try {
    const { sprintId } = req.body;

    let update;
    if (sprintId) {
      update = { $addToSet: { sprints: sprintId } };
    } else {
      update = { sprints: [] };
    }

    const epic = await Epic.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).populate('sprints', 'name status startDate endDate');

    if (!epic) {
      return res.status(404).json({
        success: false,
        message: 'Epic non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: epic
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'assignation au sprint'
    });
  }
};

// @desc    Obtenir tous les labels d'entité uniques
// @route   GET /api/epics/entity-labels
// @access  Private
exports.getEntityLabels = async (req, res) => {
  try {
    const labels = await Epic.getUniqueEntityLabels();
    res.status(200).json({
      success: true,
      data: labels
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des labels d\'entité'
    });
  }
};

// @desc    Obtenir les statistiques des epics
// @route   GET /api/epics/stats
// @access  Private
exports.getStats = async (req, res) => {
  try {
    const { sprint, issueType, year, quarter } = req.query;

    // Construire le filtre de base
    const baseMatch = {};
    if (sprint) {
      const ids = sprint.split(',').map(id => id.trim()).filter(Boolean);
      baseMatch.sprints = ids.length === 1
        ? new mongoose.Types.ObjectId(ids[0])
        : { $in: ids.map(id => new mongoose.Types.ObjectId(id)) };
    }
    const issueTypes = parseIssueTypes(issueType);
    if (issueTypes.length) baseMatch.issueType = buildIssueTypeFilter(issueTypes);

    // Filtre par année et trimestre (basé sur les dates des sprints)
    if (year || quarter) {
      let startDate, endDate;
      const yearNum = year ? parseInt(year) : new Date().getFullYear();

      if (quarter) {
        const quarterNum = parseInt(quarter);
        const startMonth = (quarterNum - 1) * 3;
        startDate = new Date(yearNum, startMonth, 1);
        endDate = new Date(yearNum, startMonth + 3, 0, 23, 59, 59);
      } else if (year) {
        startDate = new Date(yearNum, 0, 1);
        endDate = new Date(yearNum, 11, 31, 23, 59, 59);
      }

      if (startDate && endDate) {
        const sprintsInPeriod = await Sprint.find({
          $or: [
            { startDate: { $gte: startDate, $lte: endDate } },
            { endDate: { $gte: startDate, $lte: endDate } },
            { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
          ]
        }).select('_id');

        const sprintIds = sprintsInPeriod.map(s => s._id);
        if (sprintIds.length > 0) {
          baseMatch.sprints = { $in: sprintIds };
        } else {
          baseMatch.sprints = { $size: 0 };
        }
      }
    }

    // Si on filtre uniquement par Epic, calculer les SP des enfants
    if (issueTypes.length === 1 && issueTypes[0].toLowerCase() === 'epic') {
      // Récupérer tous les Epics correspondant aux filtres
      const epicFilter = { issueType: { $regex: /^epic$/i } };
      if (baseMatch.sprints) epicFilter.sprints = baseMatch.sprints;

      const epics = await Epic.find(epicFilter, { key: 1 });
      const epicKeys = epics.map(e => e.key);

      // Filtre pour les enfants (items avec parentKey pointant vers un Epic)
      const childrenMatch = { parentKey: { $in: epicKeys } };
      if (baseMatch.sprints) childrenMatch.sprints = baseMatch.sprints;

      // Calculer les stats des enfants
      const childrenStats = await Epic.aggregate([
        { $match: childrenMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalStoryPoints: { $sum: '$storyPoints' }
          }
        },
        {
          $project: {
            status: '$_id',
            count: 1,
            totalStoryPoints: 1,
            _id: 0
          }
        }
      ]);

      // Calculer les totaux des enfants
      const childrenTotals = await Epic.aggregate([
        { $match: childrenMatch },
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            totalStoryPoints: { $sum: '$storyPoints' },
            deliveredStoryPoints: {
              $sum: { $cond: [{ $eq: ['$status', 'done'] }, '$storyPoints', 0] }
            }
          }
        }
      ]);

      const totalsData = childrenTotals[0] || { totalItems: 0, totalStoryPoints: 0, deliveredStoryPoints: 0 };

      // Répartition par entité de l'Epic parent, avec nombre d'US et SP des enfants
      const epicsWithEntities = await Epic.find(epicFilter, { key: 1, entityLabels: 1 });
      const epicEntityMap = {};
      epicsWithEntities.forEach(e => {
        const labels = (e.entityLabels || []).map(l => l.name).filter(Boolean);
        epicEntityMap[e.key] = labels.length > 0 ? labels : ['Sans entité'];
      });

      // Compter les enfants par entité de leur Epic parent
      const children = await Epic.find(childrenMatch, { parentKey: 1, storyPoints: 1 });
      const entityAgg = {};
      children.forEach(child => {
        const entities = epicEntityMap[child.parentKey] || ['Sans entité'];
        entities.forEach(entity => {
          if (!entityAgg[entity]) entityAgg[entity] = { count: 0, storyPoints: 0 };
          entityAgg[entity].count += 1;
          entityAgg[entity].storyPoints += child.storyPoints || 0;
        });
      });
      const byEntityChildren = Object.entries(entityAgg)
        .map(([entity, data]) => ({ entity, count: data.count, storyPoints: data.storyPoints }))
        .sort((a, b) => b.count - a.count);

      return res.status(200).json({
        success: true,
        data: {
          byStatus: childrenStats,
          byCategory: [],
          byEntity: byEntityChildren,
          totals: {
            totalEpics: epics.length,
            totalStoryPoints: totalsData.totalStoryPoints,
            deliveredStoryPoints: totalsData.deliveredStoryPoints,
            avgStoryPoints: totalsData.totalItems > 0 ? totalsData.totalStoryPoints / totalsData.totalItems : 0
          }
        }
      });
    }

    // Sinon, stats classiques
    const [byStatus, byCategory, totals, byEntity] = await Promise.all([
      Epic.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalStoryPoints: { $sum: '$storyPoints' }
          }
        },
        {
          $project: {
            status: '$_id',
            count: 1,
            totalStoryPoints: 1,
            _id: 0
          }
        }
      ]),
      Epic.getStatsByCategory(sprint),
      Epic.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalEpics: { $sum: 1 },
            totalStoryPoints: { $sum: '$storyPoints' },
            avgStoryPoints: { $avg: '$storyPoints' }
          }
        }
      ]),
      Epic.aggregate([
        { $match: baseMatch },
        { $unwind: { path: '$entityLabels', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: { $ifNull: ['$entityLabels.name', 'Sans entité'] },
          count: { $sum: 1 },
          storyPoints: { $sum: '$storyPoints' }
        }},
        { $project: { entity: '$_id', count: 1, storyPoints: 1, _id: 0 } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        byStatus,
        byCategory,
        byEntity,
        totals: totals[0] || { totalEpics: 0, totalStoryPoints: 0, avgStoryPoints: 0 }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};
