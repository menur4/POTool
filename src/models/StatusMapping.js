const mongoose = require('mongoose');

const StatusMappingSchema = new mongoose.Schema({
  jiraStatus: {
    type: String,
    required: [true, 'Le statut Jira est requis'],
    trim: true
  },
  internalStatus: {
    type: String,
    required: [true, 'Le statut interne est requis'],
    enum: ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index unique case-insensitive sur jiraStatus
StatusMappingSchema.index(
  { jiraStatus: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

module.exports = mongoose.model('StatusMapping', StatusMappingSchema);
