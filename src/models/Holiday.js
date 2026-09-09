const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'La date est requise']
  },
  name: {
    type: String,
    required: [true, 'Le nom du jour férié est requis'],
    trim: true,
    maxlength: [200, 'Le nom ne peut pas dépasser 200 caractères']
  },
  country: {
    type: String,
    enum: ['FR', 'MA'],
    required: [true, 'Le pays est requis']
  },
  isCustom: {
    type: Boolean,
    default: false
  },
  year: {
    type: Number,
    required: [true, 'L\'année est requise']
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

// Index composé pour éviter les doublons
HolidaySchema.index({ date: 1, country: 1 }, { unique: true });
// Index pour les requêtes par plage
HolidaySchema.index({ year: 1, country: 1 });

// Middleware pour mettre à jour la date de modification
HolidaySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Holiday', HolidaySchema);
