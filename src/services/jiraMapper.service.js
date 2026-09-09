const { normalizeStatus } = require('./excelImport.service');

// Flatten ADF (Atlassian Document Format) description to plain text
function adfToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(adfToText).join(' ');
  }
  return '';
}

function mapJiraIssueToPriority(priority) {
  if (!priority) return 'medium';
  const map = { Highest: 'highest', High: 'high', Medium: 'medium', Low: 'low', Lowest: 'lowest' };
  return map[priority] || 'medium';
}

function mapJiraIssueToCategory(issueType) {
  if (!issueType) return undefined;
  const t = issueType.toLowerCase();
  if (['bug', 'defect', 'incident'].includes(t)) return 'bug';
  if (['improvement', 'enhancement'].includes(t)) return 'improvement';
  if (['technical task', 'technical debt', 'tech debt', 'spike'].includes(t)) return 'tech_debt';
  if (['documentation', 'doc'].includes(t)) return 'documentation';
  return 'feature';
}

// Champs Jira connus, mappés vers des colonnes dédiées de l'Epic.
// (clé = id du champ Jira, valeur = fonction d'application)
const KNOWN_FIELD_MAPPERS = {
  summary: (epic, f) => { epic.title = f.summary || epic.title || ''; },
  description: (epic, f) => {
    const d = adfToText(f.description).trim().slice(0, 5000);
    if (d) epic.description = d;
  },
  status: (epic, f, ctx) => {
    const raw = f.status?.name || '';
    epic.jiraStatus = raw;
    epic.status = normalizeStatus(raw, ctx.userMappings);
  },
  priority: (epic, f) => { epic.priority = mapJiraIssueToPriority(f.priority?.name); },
  issuetype: (epic, f) => {
    epic.issueType = f.issuetype?.name || undefined;
    epic.category = mapJiraIssueToCategory(f.issuetype?.name);
  },
  labels: (epic, f) => { epic.tags = Array.isArray(f.labels) ? f.labels : []; },
  reporter: (epic, f) => { epic.reporter = f.reporter?.displayName || undefined; },
  duedate: (epic, f) => { epic.dueDate = f.duedate ? new Date(f.duedate) : undefined; },
  created: (epic, f) => { epic.startDate = f.created ? new Date(f.created) : undefined; },
  parent: (epic, f) => {
    epic.parentKey = f.parent?.key || undefined;
    epic.parentSummary = f.parent?.fields?.summary || undefined;
  }
};

// Sélection par défaut (comportement historique) quand l'utilisateur n'a rien choisi.
const DEFAULT_FIELDS = [
  'summary', 'description', 'status', 'priority', 'issuetype',
  'labels', 'reporter', 'duedate', 'created', 'parent'
];

// Détecte si une valeur ressemble au champ "Sprint" de Jira
// (tableau d'objets sprint, ou chaînes legacy greenhopper).
function looksLikeSprintValue(v) {
  if (!Array.isArray(v) || v.length === 0) return false;
  const first = v[0];
  if (first && typeof first === 'object') {
    return 'name' in first && ('state' in first || 'boardId' in first);
  }
  if (typeof first === 'string') {
    return /greenhopper.*sprint/i.test(first) || /\bstate=/.test(first);
  }
  return false;
}

// Parse le champ Sprint Jira (format moderne objet OU legacy chaîne) en
// [{ id, name, state, startDate, endDate }].
function parseJiraSprints(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  const toDate = (d) => (d && d !== '<null>' ? new Date(d) : undefined);

  return arr.map(s => {
    if (s && typeof s === 'object') {
      return {
        id: s.id != null ? Number(s.id) : undefined,
        name: s.name,
        state: s.state ? String(s.state).toLowerCase() : undefined,
        startDate: toDate(s.startDate),
        endDate: toDate(s.endDate)
      };
    }
    if (typeof s === 'string') {
      // Legacy: ...Sprint@xx[id=123,name=Sprint 5,state=CLOSED,startDate=...,endDate=...]
      const get = (k) => {
        const m = s.match(new RegExp(`${k}=([^,\\]]*)`));
        return m ? m[1] : undefined;
      };
      const id = get('id');
      return {
        id: id ? Number(id) : undefined,
        name: get('name'),
        state: (get('state') || '').toLowerCase() || undefined,
        startDate: toDate(get('startDate')),
        endDate: toDate(get('endDate'))
      };
    }
    return null;
  }).filter(s => s && (s.id != null || s.name));
}

// Extrait une valeur lisible d'un champ Jira de forme arbitraire
// (objet {value|name|displayName|key}, tableau, ADF, scalaire).
function extractFieldValue(v) {
  if (v === null || v === undefined) return undefined;
  if (Array.isArray(v)) {
    const arr = v.map(extractFieldValue).filter(x => x !== undefined && x !== null && x !== '');
    return arr.length ? arr : undefined;
  }
  if (typeof v === 'object') {
    if (v.type === 'doc') return adfToText(v).trim() || undefined;
    return v.value ?? v.name ?? v.displayName ?? v.key ?? undefined;
  }
  return v;
}

/**
 * Transforme une issue Jira en objet Epic, en n'important que les champs sélectionnés.
 *
 * @param {Object} issue - Issue brute renvoyée par l'API Jira
 * @param {string} storyPointsField - id du custom field story points (ex: customfield_10016)
 * @param {Object} userMappings - mappings de statuts personnalisés
 * @param {string} instanceUrl - URL de l'instance Jira (pour jiraUrl)
 * @param {string} importSource - origine ('jira_api' | 'jira_session')
 * @param {string[]|null} selectedFields - ids des champs à importer (null = défaut)
 */
function issueToEpic(issue, storyPointsField, userMappings, instanceUrl, importSource = 'jira_api', selectedFields = null) {
  const f = issue.fields || {};
  const base = (instanceUrl || '').replace(/\/$/, '');

  // key + title sont obligatoires : toujours renseignés.
  const epic = {
    key: issue.key,
    title: f.summary || '',
    jiraId: issue.id,
    jiraUrl: base ? `${base}/browse/${issue.key}` : undefined,
    importSource,
    importedAt: new Date()
  };

  const fields = (Array.isArray(selectedFields) && selectedFields.length)
    ? selectedFields
    : DEFAULT_FIELDS.concat(storyPointsField ? [storyPointsField] : []);

  const ctx = { userMappings };
  const custom = {};

  for (const fid of fields) {
    if (storyPointsField && fid === storyPointsField) {
      epic.storyPoints = f[storyPointsField] || 0;
    } else if (KNOWN_FIELD_MAPPERS[fid]) {
      KNOWN_FIELD_MAPPERS[fid](epic, f, ctx);
    } else if (fid in f && looksLikeSprintValue(f[fid])) {
      // Champ "Sprint" Jira → champ structuré dédié.
      const parsed = parseJiraSprints(f[fid]);
      if (parsed.length) epic.jiraSprints = parsed;
    } else if (fid in f) {
      // Champ non standard / personnalisé → stocké dans customFields.
      const val = extractFieldValue(f[fid]);
      if (val !== undefined && val !== null && val !== '') custom[fid] = val;
    }
  }

  if (Object.keys(custom).length) epic.customFields = custom;

  return epic;
}

module.exports = {
  adfToText,
  mapJiraIssueToPriority,
  mapJiraIssueToCategory,
  issueToEpic,
  extractFieldValue,
  parseJiraSprints,
  looksLikeSprintValue,
  DEFAULT_FIELDS,
  KNOWN_FIELD_MAPPERS
};
