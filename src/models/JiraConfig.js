const mongoose = require('mongoose');

const jiraConfigSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  instanceUrl: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  apiToken: {
    type: String,
    required: true
  },
  projectKey: {
    type: String,
    trim: true,
    default: ''
  },
  jql: {
    type: String,
    trim: true,
    default: ''
  },
  storyPointsField: {
    type: String,
    trim: true,
    default: 'customfield_10016'
  },
  // Ids des champs Jira à importer (vide = sélection par défaut).
  fields: {
    type: [String],
    default: []
  },
  // Borne temporelle de la synchro (filtre injecté dans la JQL).
  dateField: {
    type: String,
    trim: true,
    default: '' // '' = pas de borne ; sinon 'created' | 'updated' | 'resolved' | 'duedate'
  },
  dateFrom: {
    type: String,
    trim: true,
    default: '' // 'YYYY-MM-DD'
  },
  dateTo: {
    type: String,
    trim: true,
    default: '' // 'YYYY-MM-DD'
  },
  // Ids des sprints Jira sur lesquels borner la synchro (vide = tous).
  sprints: {
    type: [String],
    default: []
  },
  lastSync: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('JiraConfig', jiraConfigSchema);
