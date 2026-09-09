const mongoose = require('mongoose');

// Congés / absences individuels d'un membre de l'équipe (plage de dates).
// Utilisé pour le stream de capacité de la roadmap et le pré-remplissage
// des jours d'absence (daysOff) à la création des sprints.
const TimeOffSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamMember',
    required: [true, 'Le membre est requis']
  },
  startDate: {
    type: Date,
    required: [true, 'La date de début est requise']
  },
  endDate: {
    type: Date,
    required: [true, 'La date de fin est requise']
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [200, 'Le motif ne peut pas dépasser 200 caractères']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

TimeOffSchema.index({ member: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('TimeOff', TimeOffSchema);
