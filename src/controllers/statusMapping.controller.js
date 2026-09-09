const StatusMapping = require('../models/StatusMapping');
const Epic = require('../models/Epic');
const { normalizeStatus } = require('../services/excelImport.service');

// Re-applique tous les mappings courants sur les epics existants importés (ceux qui ont un jiraStatus)
const reapplyMappingsToEpics = async () => {
  const mappingDocs = await StatusMapping.find();
  const userMappings = {};
  mappingDocs.forEach(m => {
    userMappings[m.jiraStatus.toLowerCase()] = m.internalStatus;
  });

  const epics = await Epic.find({ jiraStatus: { $exists: true, $ne: '' } }).select('_id jiraStatus status');

  const bulkOps = [];
  for (const epic of epics) {
    const newStatus = normalizeStatus(epic.jiraStatus, userMappings);
    if (newStatus !== epic.status) {
      bulkOps.push({
        updateOne: {
          filter: { _id: epic._id },
          update: { $set: { status: newStatus } }
        }
      });
    }
  }

  if (bulkOps.length > 0) {
    await Epic.bulkWrite(bulkOps);
  }

  return bulkOps.length;
};

// @desc    Lister tous les mappings utilisateur
// @route   GET /api/status-mappings
// @access  Private
exports.getStatusMappings = async (req, res) => {
  try {
    const mappings = await StatusMapping.find().sort('jiraStatus');
    res.status(200).json({ success: true, data: mappings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des mappings' });
  }
};

// @desc    Créer ou mettre à jour un mapping (upsert)
// @route   POST /api/status-mappings
// @access  Private
exports.upsertStatusMapping = async (req, res) => {
  try {
    const { jiraStatus, internalStatus } = req.body;

    if (!jiraStatus || !internalStatus) {
      return res.status(400).json({ success: false, message: 'jiraStatus et internalStatus sont requis' });
    }

    const mapping = await StatusMapping.findOneAndUpdate(
      { jiraStatus: { $regex: new RegExp(`^${jiraStatus.trim()}$`, 'i') } },
      { jiraStatus: jiraStatus.trim(), internalStatus },
      { new: true, upsert: true, runValidators: true }
    );

    const updatedEpics = await reapplyMappingsToEpics();

    res.status(200).json({ success: true, data: mapping, updatedEpics });
  } catch (error) {
    console.error(error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(v => v.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde du mapping' });
  }
};

// @desc    Supprimer un mapping
// @route   DELETE /api/status-mappings/:id
// @access  Private
exports.deleteStatusMapping = async (req, res) => {
  try {
    const mapping = await StatusMapping.findByIdAndDelete(req.params.id);
    if (!mapping) {
      return res.status(404).json({ success: false, message: 'Mapping non trouvé' });
    }

    const updatedEpics = await reapplyMappingsToEpics();

    res.status(200).json({ success: true, data: {}, updatedEpics });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression du mapping' });
  }
};

// @desc    Lister les statuts Jira distincts trouvés dans les epics importés
// @route   GET /api/status-mappings/known-statuses
// @access  Private
exports.getKnownStatuses = async (req, res) => {
  try {
    const statuses = await Epic.distinct('jiraStatus', {
      jiraStatus: { $exists: true, $ne: '' }
    });
    res.status(200).json({ success: true, data: statuses.filter(Boolean).sort() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des statuts connus' });
  }
};
