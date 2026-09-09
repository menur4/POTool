const mongoose = require('mongoose');

const EpicSchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, 'La clé de l\'epic est requise'],
    trim: true,
    unique: true,
    maxlength: [50, 'La clé ne peut pas dépasser 50 caractères']
  },
  title: {
    type: String,
    required: [true, 'Le titre de l\'epic est requis'],
    trim: true,
    maxlength: [255, 'Le titre ne peut pas dépasser 255 caractères']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [5000, 'La description ne peut pas dépasser 5000 caractères']
  },
  storyPoints: {
    type: Number,
    default: 0,
    min: [0, 'Les story points ne peuvent pas être négatifs']
  },
  status: {
    type: String,
    enum: ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'],
    default: 'backlog'
  },
  priority: {
    type: String,
    enum: ['lowest', 'low', 'medium', 'high', 'highest'],
    default: 'medium'
  },
  category: {
    type: String,
    trim: true,
    maxlength: [100, 'La catégorie ne peut pas dépasser 100 caractères']
  },
  issueType: {
    type: String,
    trim: true,
    maxlength: [50, 'Le type d\'issue ne peut pas dépasser 50 caractères']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Un tag ne peut pas dépasser 50 caractères']
  }],
  entityLabels: [{
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Un label d\'entité ne peut pas dépasser 100 caractères']
    },
    color: {
      type: String,
      enum: ['default', 'primary', 'success', 'warning', 'error', 'info'],
      default: 'info'
    }
  }],
  sprints: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint'
  }],
  // Sprints Jira d'origine (importés), structurés pour le filtrage/nettoyage.
  jiraSprints: [{
    id: { type: Number },
    name: { type: String, trim: true },
    state: { type: String, trim: true },
    startDate: { type: Date },
    endDate: { type: Date }
  }],
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamMember'
  },
  reporter: {
    type: String,
    trim: true,
    maxlength: [100, 'Le reporter ne peut pas dépasser 100 caractères']
  },
  jiraId: {
    type: String,
    trim: true,
    sparse: true
  },
  jiraUrl: {
    type: String,
    trim: true
  },
  parentKey: {
    type: String,
    trim: true,
    maxlength: [50, 'La clé parent ne peut pas dépasser 50 caractères']
  },
  parentSummary: {
    type: String,
    trim: true,
    maxlength: [255, 'Le résumé parent ne peut pas dépasser 255 caractères']
  },
  startDate: {
    type: Date
  },
  dueDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  importedAt: {
    type: Date
  },
  importSource: {
    type: String,
    enum: ['manual', 'excel', 'jira_api', 'jira_session'],
    default: 'manual'
  },
  jiraStatus: {
    type: String,
    trim: true
  },
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour la recherche
EpicSchema.index({ title: 'text', description: 'text', key: 'text' });
EpicSchema.index({ status: 1, sprints: 1 });
EpicSchema.index({ category: 1 });
EpicSchema.index({ tags: 1 });
EpicSchema.index({ parentKey: 1 });
EpicSchema.index({ issueType: 1 });
EpicSchema.index({ 'jiraSprints.id': 1 });
EpicSchema.index({ 'jiraSprints.endDate': 1 });
EpicSchema.index({ 'entityLabels.name': 1 });

// Middleware pour mettre à jour la date de modification
EpicSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  // Si le statut passe à "done", enregistrer la date de completion
  if (this.isModified('status') && this.status === 'done' && !this.completedDate) {
    this.completedDate = Date.now();
  }

  // Limiter les entityLabels à 2 maximum
  if (this.entityLabels && this.entityLabels.length > 2) {
    this.entityLabels = this.entityLabels.slice(0, 2);
  }

  next();
});

// Méthode statique pour obtenir les statistiques par statut
EpicSchema.statics.getStatsByStatus = async function(sprintId = null) {
  const match = sprintId ? { sprints: new mongoose.Types.ObjectId(sprintId) } : {};

  return this.aggregate([
    { $match: match },
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
};

// Méthode statique pour obtenir les statistiques par catégorie
EpicSchema.statics.getStatsByCategory = async function(sprintId = null) {
  const match = sprintId ? { sprints: new mongoose.Types.ObjectId(sprintId) } : {};

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalStoryPoints: { $sum: '$storyPoints' }
      }
    },
    {
      $project: {
        category: '$_id',
        count: 1,
        totalStoryPoints: 1,
        _id: 0
      }
    },
    { $sort: { totalStoryPoints: -1 } }
  ]);
};

// Méthode statique pour obtenir tous les labels d'entité uniques
EpicSchema.statics.getUniqueEntityLabels = async function() {
  const result = await this.aggregate([
    { $match: { entityLabels: { $exists: true, $ne: [] } } },
    { $unwind: '$entityLabels' },
    // Normalize: old string labels → {name, color}, new object labels → keep as-is
    { $addFields: {
      normalizedLabel: {
        name: { $ifNull: ['$entityLabels.name', '$entityLabels'] },
        color: { $ifNull: ['$entityLabels.color', 'info'] }
      }
    }},
    { $group: { _id: { name: '$normalizedLabel.name', color: '$normalizedLabel.color' } } },
    { $sort: { '_id.name': 1 } }
  ]);
  return result.map(r => ({ name: r._id.name, color: r._id.color || 'info' }))
    .filter(r => r.name); // Filter out any null/undefined names
};

module.exports = mongoose.model('Epic', EpicSchema);
