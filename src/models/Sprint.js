const mongoose = require('mongoose');
const { getMoroccanHolidays } = require('../services/holiday.service');

const SprintSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom du sprint est requis'],
    trim: true,
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
  },
  startDate: {
    type: Date,
    required: [true, 'La date de début est requise']
  },
  endDate: {
    type: Date,
    required: [true, 'La date de fin est requise']
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'closed'],
    default: 'draft'
  },
  // Lien vers le sprint Jira d'origine (clé de réconciliation).
  jiraId: {
    type: Number,
    index: true,
    sparse: true,
    default: null
  },
  team: [{
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamMember',
      required: true
    },
    availability: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    daysOff: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  constraints: {
    meetingsPercent: {
      type: Number,
      default: 10,
      min: 0,
      max: 100
    },
    bugsPercent: {
      type: Number,
      default: 10,
      min: 0,
      max: 100
    },
    tnrPercent: {
      type: Number,
      default: 5,
      min: 0,
      max: 100
    }
  },
  actualConstraints: {
    meetingsPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    bugsPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    tnrPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  actualTeam: [{
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamMember'
    },
    availability: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    daysOff: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  deliveredStoryPoints: {
    type: Number,
    default: 0
  },
  capacity: {
    workingDays: {
      type: Number,
      default: 0
    },
    planned: {
      type: Number,
      default: 0
    },
    actual: {
      type: Number,
      default: 0
    }
  },
  velocity: {
    planned: {
      type: Number,
      default: 0
    },
    actual: {
      type: Number,
      default: 0
    }
  },
  goal: {
    type: String,
    trim: true,
    maxlength: [500, 'L\'objectif ne peut pas dépasser 500 caractères']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Les notes ne peuvent pas dépasser 2000 caractères']
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

// Validation: endDate doit être après startDate
SprintSchema.pre('validate', function(next) {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    this.invalidate('endDate', 'La date de fin doit être postérieure à la date de début');
  }
  next();
});

// Middleware pour mettre à jour la date de modification
SprintSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Méthode virtuelle pour calculer la durée en jours ouvrés (hors weekends + jours fériés marocains)
SprintSchema.virtual('workingDays').get(function() {
  if (!this.startDate || !this.endDate) return 0;

  const start = new Date(this.startDate);
  const end = new Date(this.endDate);

  // Collecter les jours fériés marocains pour les années couvertes par le sprint
  const holidaySet = new Set();
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    getMoroccanHolidays(y).forEach(h => {
      holidaySet.add(h.date.toISOString().split('T')[0]);
    });
  }

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
});

// Inclure les virtuals dans JSON
SprintSchema.set('toJSON', { virtuals: true });
SprintSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Sprint', SprintSchema);
