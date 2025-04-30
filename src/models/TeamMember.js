const mongoose = require('mongoose');

const TeamMemberSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Le prénom est requis'],
    trim: true,
    maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
  },
  lastName: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Veuillez fournir un email valide'
    ]
  },
  role: {
    type: String,
    enum: [
      'chef_de_projet',      // Chef de Projet
      'delivery_manager',    // Delivery Manager
      'tech_lead',           // Tech Lead
      'developpeur',         // Développeur
      'business_analyst',    // Business Analyst
      'qa_lead',             // QA Lead
      'qa',                  // QA
      'support',             // Support
      'support_lead',        // Support Lead
      'developer',           // Ancienne valeur (pour compatibilité)
      'designer',            // Ancienne valeur (pour compatibilité)
      'tester',              // Ancienne valeur (pour compatibilité)
      'product_owner',       // Ancienne valeur (pour compatibilité)
      'scrum_master',        // Ancienne valeur (pour compatibilité)
      'other'                // Autre
    ],
    default: 'developpeur'
  },
  dailyRate: {
    type: Number,
    required: [true, 'Le TJM est requis'],
    min: [0, 'Le TJM ne peut pas être négatif']
  },
  active: {
    type: Boolean,
    default: true
  },
  profile: {
    type: String,
    enum: ['watcher', 'power-user', 'admin'],
    default: 'watcher',
    required: [true, 'Le profil est requis']
  },
  city: {
    type: String,
    trim: true,
    maxlength: [100, 'La ville ne peut pas dépasser 100 caractères']
  },
  country: {
    type: String,
    trim: true,
    maxlength: [100, 'Le pays ne peut pas dépasser 100 caractères']
  },
  photo: {
    type: String,
    // Pas de valeur par défaut pour permettre l'upload de photos
    // L'avatar par défaut sera géré côté client
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

// Middleware pour mettre à jour la date de modification
TeamMemberSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('TeamMember', TeamMemberSchema);
