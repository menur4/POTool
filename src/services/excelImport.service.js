const XLSX = require('xlsx');

/**
 * Configuration par défaut du mappage des colonnes Jira
 */
const DEFAULT_COLUMN_MAPPING = {
  key: ['Issue key', 'Key', 'Clé', 'Issue Key'],
  title: ['Summary', 'Titre', 'Title', 'Résumé'],
  description: ['Description'],
  storyPoints: [
    'Custom field (Story Points)', 'Custom field (Story point estimate)',
    'Story Points', 'Story points', 'Points', 'SP', 'Estimation'
  ],
  status: ['Status', 'Statut', 'État'],
  priority: ['Priority', 'Priorité', 'Custom field (Priority)'],
  category: [
    'Catégorie', 'Category', 'Component', 'Components',
    'Custom field (Category)'
  ],
  assignee: ['Assignee', 'Assigné', 'Responsable'],
  reporter: ['Reporter', 'Rapporteur', 'Créateur', 'Creator'],
  tags: ['Labels', 'Tags', 'Étiquettes'],
  dueDate: ['Due Date', 'Due date', 'Échéance', 'Date d\'échéance', 'Custom field (Due Date-)'],
  startDate: ['Start Date', 'Start date', 'Date de début', 'Custom field (Start date)', 'Created'],
  jiraId: ['Issue id', 'ID', 'Jira ID'],
  sprint: ['Sprint', 'Custom field (Sprint)', 'Custom field (Planned Sprint)'],
  issueType: ['Issue Type', 'Type de ticket', 'Custom field (Type de ticket)'],
  projectKey: ['Project key', 'Projet'],
  resolution: ['Resolution', 'Résolution'],
  // Parent key est la clé de l'epic parent (ex: PROJ-123)
  parentKey: ['Parent key', 'Epic Link', 'Custom field (Epic Link)'],
  // Parent summary est le titre de l'epic parent
  parentSummary: ['Parent summary', 'Epic Name', 'Custom field (Epic Name)']
};

/**
 * Mappage des statuts Jira vers les statuts internes
 */
const STATUS_MAPPING = {
  // Anglais
  'backlog': 'backlog',
  'to do': 'todo',
  'todo': 'todo',
  'open': 'todo',
  'new': 'todo',
  'created': 'todo',
  'ready': 'todo',
  'ready for development': 'todo',
  'selected for development': 'todo',
  'in progress': 'in_progress',
  'in development': 'in_progress',
  'development': 'in_progress',
  'developing': 'in_progress',
  'active': 'in_progress',
  'in analysis': 'in_progress',
  'analysis': 'in_progress',
  'in review': 'review',
  'review': 'review',
  'code review': 'review',
  'testing': 'review',
  'in testing': 'review',
  'qa': 'review',
  'in qa': 'review',
  'validation': 'review',
  'awaiting review': 'review',
  'pending': 'review',
  'done': 'done',
  'closed': 'done',
  'resolved': 'done',
  'complete': 'done',
  'completed': 'done',
  'released': 'done',
  'deployed': 'done',
  'delivered': 'done',
  'ready for oat testing': 'done',
  'ready for deployment': 'done',
  'ready to deploy': 'done',
  'deployment in production': 'done',
  'cancelled': 'cancelled',
  'canceled': 'cancelled',
  'won\'t do': 'cancelled',
  'wont do': 'cancelled',
  'rejected': 'cancelled',
  'duplicate': 'cancelled',
  'obsolete': 'cancelled',

  // Français
  'à faire': 'todo',
  'nouveau': 'todo',
  'ouvert': 'todo',
  'prêt': 'todo',
  'en cours': 'in_progress',
  'en développement': 'in_progress',
  'en analyse': 'in_progress',
  'en revue': 'review',
  'en test': 'review',
  'en validation': 'review',
  'terminé': 'done',
  'fermé': 'done',
  'résolu': 'done',
  'livré': 'done',
  'déployé': 'done',
  'annulé': 'cancelled',
  'rejeté': 'cancelled',
  'doublon': 'cancelled'
};

/**
 * Mappage des types d'issue Jira vers les catégories internes
 */
const ISSUE_TYPE_TO_CATEGORY = {
  // Anglais
  'story': 'feature',
  'user story': 'feature',
  'feature': 'feature',
  'new feature': 'feature',
  'epic': 'feature',
  'task': 'feature',
  'sub-task': 'feature',
  'subtask': 'feature',
  'bug': 'bug',
  'defect': 'bug',
  'incident': 'bug',
  'improvement': 'improvement',
  'enhancement': 'improvement',
  'change request': 'improvement',
  'technical task': 'tech_debt',
  'technical debt': 'tech_debt',
  'tech debt': 'tech_debt',
  'spike': 'tech_debt',
  'documentation': 'documentation',
  'doc': 'documentation',

  // Français
  'histoire': 'feature',
  'fonctionnalité': 'feature',
  'tâche': 'feature',
  'sous-tâche': 'feature',
  'anomalie': 'bug',
  'défaut': 'bug',
  'amélioration': 'improvement',
  'dette technique': 'tech_debt'
};

/**
 * Mappage des priorités Jira vers les priorités internes
 */
const PRIORITY_MAPPING = {
  'lowest': 'lowest',
  'low': 'low',
  'medium': 'medium',
  'high': 'high',
  'highest': 'highest',
  'critical': 'highest',
  'blocker': 'highest',
  'minor': 'low',
  'major': 'high',
  'trivial': 'lowest',

  // Français
  'très basse': 'lowest',
  'basse': 'low',
  'moyenne': 'medium',
  'haute': 'high',
  'très haute': 'highest',
  'critique': 'highest',
  'bloquant': 'highest'
};

/**
 * Parse un fichier Excel et extrait les données
 * @param {Buffer} fileBuffer - Buffer du fichier Excel
 * @param {Object} options - Options de parsing
 * @returns {Object} Données parsées et métadonnées
 */
const parseExcelFile = (fileBuffer, options = {}) => {
  const { sheetName, headerRow = 1 } = options;

  // Lire le fichier Excel
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });

  // Sélectionner la feuille
  const sheet = sheetName
    ? workbook.Sheets[sheetName]
    : workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    throw new Error(`Feuille "${sheetName || workbook.SheetNames[0]}" non trouvée`);
  }

  // Convertir en JSON
  const jsonData = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false
  });

  if (jsonData.length < 2) {
    throw new Error('Le fichier ne contient pas assez de données');
  }

  // Extraire les en-têtes
  const headers = jsonData[headerRow - 1].map(h => String(h).trim());

  // Extraire les données
  const rows = jsonData.slice(headerRow).filter(row =>
    row.some(cell => cell !== null && cell !== undefined && cell !== '')
  );

  return {
    headers,
    rows,
    sheetNames: workbook.SheetNames,
    totalRows: rows.length
  };
};

/**
 * Détecte automatiquement le mappage des colonnes
 * @param {Array} headers - En-têtes du fichier
 * @param {Object} customMapping - Mappage personnalisé (optionnel)
 * @returns {Object} Mappage détecté
 */
const detectColumnMapping = (headers, customMapping = {}) => {
  const mapping = {};
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  // Fusionner le mappage par défaut avec le mappage personnalisé
  const columnConfig = { ...DEFAULT_COLUMN_MAPPING, ...customMapping };

  for (const [field, possibleNames] of Object.entries(columnConfig)) {
    const normalizedNames = possibleNames.map(n => n.toLowerCase().trim());

    const index = normalizedHeaders.findIndex(h =>
      normalizedNames.includes(h) || normalizedNames.some(n => h.includes(n))
    );

    if (index !== -1) {
      mapping[field] = index;
    }
  }

  return mapping;
};

/**
 * Normalise un statut
 * @param {string} status - Statut brut
 * @returns {string} Statut normalisé
 */
const normalizeStatus = (status, userMappings = {}) => {
  if (!status) return 'backlog';
  const normalized = String(status).toLowerCase().trim();
  // Les mappings utilisateur ont priorité sur les mappings intégrés
  return userMappings[normalized] || STATUS_MAPPING[normalized] || 'backlog';
};

/**
 * Normalise une priorité
 * @param {string} priority - Priorité brute
 * @returns {string} Priorité normalisée
 */
const normalizePriority = (priority) => {
  if (!priority) return 'medium';
  const normalized = String(priority).toLowerCase().trim();
  return PRIORITY_MAPPING[normalized] || 'medium';
};

/**
 * Parse les tags/labels depuis une chaîne
 * Gère plusieurs formats Jira: virgules, espaces, retours à la ligne, JSON
 * @param {string|Array} tags - Tags bruts
 * @returns {Array} Tableau de tags
 */
const parseTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean);

  const tagString = String(tags).trim();
  if (!tagString) return [];

  // Essayer de parser comme JSON si c'est une chaîne qui commence par [
  if (tagString.startsWith('[')) {
    try {
      const parsed = JSON.parse(tagString);
      if (Array.isArray(parsed)) {
        return parsed.map(t => String(t).trim()).filter(Boolean);
      }
    } catch (e) {
      // Continuer avec le parsing par défaut
    }
  }

  // Détecter le séparateur utilisé
  // Priorité: virgule > point-virgule > retour à la ligne > espace (si pas de virgule/point-virgule)
  let separator;
  if (tagString.includes(',')) {
    separator = /[,]/;
  } else if (tagString.includes(';')) {
    separator = /[;]/;
  } else if (tagString.includes('\n')) {
    separator = /[\n\r]+/;
  } else if (tagString.includes(' ')) {
    // Utiliser l'espace seulement s'il n'y a pas d'autres séparateurs
    // et que ça ressemble à des labels (pas une phrase)
    const words = tagString.split(/\s+/);
    if (words.length > 1 && words.every(w => w.length < 50 && !w.includes('.'))) {
      separator = /\s+/;
    }
  }

  if (separator) {
    return tagString.split(separator).map(t => t.trim()).filter(Boolean);
  }

  // Si pas de séparateur détecté, retourner le tag unique
  return [tagString];
};

/**
 * Parse une date depuis différents formats
 * @param {any} dateValue - Valeur de date
 * @returns {Date|null} Date parsée ou null
 */
const parseDate = (dateValue) => {
  if (!dateValue) return null;

  // Si c'est déjà une Date
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? null : dateValue;
  }

  // Si c'est un nombre (Excel serial date)
  if (typeof dateValue === 'number') {
    const date = XLSX.SSF.parse_date_code(dateValue);
    if (date) {
      return new Date(date.y, date.m - 1, date.d);
    }
  }

  // Essayer de parser comme chaîne
  const parsed = new Date(dateValue);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Transforme une ligne de données en objet Epic
 * @param {Array} row - Ligne de données
 * @param {Object} mapping - Mappage des colonnes
 * @param {Object} options - Options de transformation
 * @returns {Object} Objet Epic
 */
/**
 * Détermine la catégorie à partir du type d'issue ou de la catégorie existante
 * @param {string} issueType - Type d'issue Jira
 * @param {string} category - Catégorie existante
 * @param {string} defaultCategory - Catégorie par défaut
 * @returns {string} Catégorie normalisée
 */
const normalizeCategory = (issueType, category, defaultCategory) => {
  // D'abord essayer de mapper le type d'issue
  if (issueType) {
    const normalized = String(issueType).toLowerCase().trim();
    if (ISSUE_TYPE_TO_CATEGORY[normalized]) {
      return ISSUE_TYPE_TO_CATEGORY[normalized];
    }
  }

  // Sinon utiliser la catégorie fournie si elle est valide
  if (category) {
    const validCategories = ['feature', 'bug', 'improvement', 'tech_debt', 'documentation'];
    const normalizedCat = String(category).toLowerCase().trim();
    if (validCategories.includes(normalizedCat)) {
      return normalizedCat;
    }
  }

  // Sinon utiliser la catégorie par défaut
  return defaultCategory || 'feature';
};

const transformRowToEpic = (row, mapping, options = {}) => {
  const { defaultCategory, importSource = 'excel', userMappings = {} } = options;

  const getValue = (field) => {
    const index = mapping[field];
    return index !== undefined ? row[index] : undefined;
  };

  const key = getValue('key');
  const title = getValue('title');

  // Validation minimale
  if (!key && !title) {
    return null;
  }

  // Récupérer le type d'issue Jira (Epic, Story, Task, Bug, etc.)
  const issueType = getValue('issueType');
  const issueTypeStr = issueType ? String(issueType).trim() : null;

  // Déterminer la catégorie à partir du type d'issue ou de la catégorie existante
  const categoryValue = getValue('category');
  const category = normalizeCategory(issueType, categoryValue, defaultCategory);

  // Récupérer les informations du parent (Epic)
  const parentKey = getValue('parentKey');
  const parentSummary = getValue('parentSummary');

  const epic = {
    key: key ? String(key).trim() : `IMPORT-${Date.now()}`,
    title: title ? String(title).trim() : 'Sans titre',
    description: getValue('description') ? String(getValue('description')).trim() : '',
    storyPoints: parseFloat(getValue('storyPoints')) || 0,
    jiraStatus: getValue('status') ? String(getValue('status')).trim() : '',
    status: normalizeStatus(getValue('status'), userMappings),
    priority: normalizePriority(getValue('priority')),
    category,
    issueType: issueTypeStr,
    tags: parseTags(getValue('tags')),
    reporter: getValue('reporter') ? String(getValue('reporter')).trim() : '',
    startDate: parseDate(getValue('startDate')),
    dueDate: parseDate(getValue('dueDate')),
    jiraId: getValue('jiraId') ? String(getValue('jiraId')).trim() : null,
    parentKey: parentKey ? String(parentKey).trim() : null,
    parentSummary: parentSummary ? String(parentSummary).trim() : null,
    importedAt: new Date(),
    importSource
  };

  return epic;
};

/**
 * Importe des epics depuis un fichier Excel
 * @param {Buffer} fileBuffer - Buffer du fichier Excel
 * @param {Object} options - Options d'import
 * @returns {Object} Résultat de l'import
 */
const importFromExcel = (fileBuffer, options = {}, userMappings = {}) => {
  const {
    sheetName,
    headerRow = 1,
    customMapping = {},
    defaultCategory,
    skipDuplicates = true
  } = options;

  // Parser le fichier
  const { headers, rows, sheetNames, totalRows } = parseExcelFile(fileBuffer, {
    sheetName,
    headerRow
  });

  // Détecter le mappage des colonnes
  const mapping = detectColumnMapping(headers, customMapping);

  // Vérifier qu'on a au moins la clé ou le titre
  if (mapping.key === undefined && mapping.title === undefined) {
    throw new Error('Impossible de détecter les colonnes "Key" ou "Title" dans le fichier');
  }

  // Transformer les lignes en epics
  const epics = [];
  const errors = [];
  const seenKeys = new Set();

  rows.forEach((row, index) => {
    try {
      const epic = transformRowToEpic(row, mapping, { defaultCategory, userMappings });

      if (!epic) {
        errors.push({
          row: index + headerRow + 1,
          error: 'Ligne vide ou invalide'
        });
        return;
      }

      // Vérifier les doublons
      if (seenKeys.has(epic.key)) {
        if (skipDuplicates) {
          errors.push({
            row: index + headerRow + 1,
            error: `Clé en doublon ignorée: ${epic.key}`
          });
          return;
        }
        // Si on ne skip pas, modifier la clé
        epic.key = `${epic.key}-${Date.now()}`;
      }

      seenKeys.add(epic.key);
      epics.push(epic);
    } catch (e) {
      errors.push({
        row: index + headerRow + 1,
        error: e.message
      });
    }
  });

  // Détecter automatiquement les Epics:
  // Les items dont la clé est référencée comme parent d'autres items sont des Epics
  const parentKeys = new Set();
  const parentInfo = new Map(); // Stocke parentKey -> { title (parentSummary) }

  epics.forEach(epic => {
    if (epic.parentKey) {
      parentKeys.add(epic.parentKey);
      // Garder le titre du parent (parentSummary) s'il existe
      if (epic.parentSummary && !parentInfo.has(epic.parentKey)) {
        parentInfo.set(epic.parentKey, {
          title: epic.parentSummary
        });
      }
    }
  });

  // Marquer les items parents comme "Epic"
  const existingKeys = new Set(epics.map(e => e.key));

  epics.forEach(epic => {
    if (parentKeys.has(epic.key)) {
      epic.issueType = 'Epic';
    }
    // Si l'item n'a pas de type et n'est pas un parent, c'est probablement une Story
    if (!epic.issueType && !parentKeys.has(epic.key)) {
      epic.issueType = 'Story';
    }
  });

  // Créer les Epics manquants (référencés comme parent mais non présents dans l'import)
  const createdEpics = [];
  parentKeys.forEach(parentKey => {
    if (!existingKeys.has(parentKey)) {
      const info = parentInfo.get(parentKey) || {};
      const epic = {
        key: parentKey,
        title: info.title || `Epic ${parentKey}`,
        description: '',
        storyPoints: 0,
        status: 'backlog',
        priority: 'medium',
        category: 'feature',
        issueType: 'Epic',
        tags: [],
        importedAt: new Date(),
        importSource: 'excel'
      };
      epics.push(epic);
      createdEpics.push(parentKey);
    }
  });

  // Calculer le total des story points
  const totalStoryPoints = epics.reduce((sum, epic) => sum + (epic.storyPoints || 0), 0);

  return {
    success: true,
    epics,
    metadata: {
      totalRows,
      importedCount: epics.length,
      errorCount: errors.length,
      totalStoryPoints,
      headers,
      detectedMapping: mapping,
      sheetNames,
      epicCount: parentKeys.size,
      autoGeneratedEpics: createdEpics.length
    },
    errors: errors.length > 0 ? errors : undefined
  };
};

/**
 * Valide un fichier avant import (prévisualisation)
 * @param {Buffer} fileBuffer - Buffer du fichier
 * @param {Object} options - Options
 * @returns {Object} Résultat de validation avec aperçu
 */
const validateAndPreview = (fileBuffer, options = {}, userMappings = {}) => {
  const result = importFromExcel(fileBuffer, options, userMappings);

  return {
    ...result,
    preview: result.epics,
    epics: undefined
  };
};

module.exports = {
  parseExcelFile,
  detectColumnMapping,
  importFromExcel,
  validateAndPreview,
  normalizeStatus,
  normalizePriority,
  normalizeCategory,
  DEFAULT_COLUMN_MAPPING,
  STATUS_MAPPING,
  PRIORITY_MAPPING,
  ISSUE_TYPE_TO_CATEGORY
};
