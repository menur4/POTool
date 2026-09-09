const JiraConfig = require('../models/JiraConfig');
const Epic = require('../models/Epic');
const StatusMapping = require('../models/StatusMapping');
const { testConnection, getProjects, getFields, getAllIssues, getProjectSprints } = require('../services/jiraClient');
const { issueToEpic, DEFAULT_FIELDS } = require('../services/jiraMapper.service');

// Résout la liste des champs Jira à importer pour une config donnée.
// Vide = sélection par défaut. 'summary' et le champ story points sont
// TOUJOURS inclus (les SP sont essentiels même s'ils ne sont pas cochés).
function resolveSyncFields(config) {
  const base = (config.fields && config.fields.length)
    ? config.fields.slice()
    : DEFAULT_FIELDS.slice();
  const set = new Set(base);
  set.add('summary');
  if (config.storyPointsField) set.add(config.storyPointsField);
  return Array.from(set);
}

// Charge les mappings de statuts personnalisés sous forme { jiraStatusLower: internalStatus }
async function loadUserMappings() {
  const mappings = await StatusMapping.find({});
  const userMappings = {};
  mappings.forEach(m => { userMappings[m.jiraStatus.toLowerCase().trim()] = m.internalStatus; });
  return userMappings;
}

// Détermine la JQL à exécuter : la JQL personnalisée est prioritaire,
// sinon on construit une requête à partir du projet sélectionné.
function resolveJql({ jql, projectKey }) {
  if (jql && jql.trim()) return jql.trim();
  if (projectKey && projectKey.trim()) return `project = "${projectKey.trim()}" ORDER BY created DESC`;
  return null;
}

const ALLOWED_DATE_FIELDS = ['created', 'updated', 'resolved', 'duedate'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Injecte des filtres (borne temporelle, sprints) dans une JQL en préservant
// le ORDER BY. La partie WHERE existante est mise entre parenthèses (sûreté OR).
function composeJql(baseJql, { dateField, dateFrom, dateTo, sprints } = {}) {
  if (!baseJql) return baseJql;

  const extra = [];

  // Borne temporelle
  if (ALLOWED_DATE_FIELDS.includes(dateField)) {
    const from = DATE_RE.test(dateFrom || '') ? dateFrom : null;
    const to = DATE_RE.test(dateTo || '') ? dateTo : null;
    if (from) extra.push(`${dateField} >= "${from}"`);
    if (to) extra.push(`${dateField} <= "${to} 23:59"`);
  }

  // Sprints (ids numériques uniquement → pas d'injection)
  const sprintIds = Array.isArray(sprints)
    ? sprints.map(s => String(s).trim()).filter(s => /^\d+$/.test(s))
    : [];
  if (sprintIds.length) extra.push(`sprint in (${sprintIds.join(', ')})`);

  if (!extra.length) return baseJql;

  const m = baseJql.match(/\border\s+by\b/i);
  let where = baseJql;
  let orderBy = '';
  if (m) {
    where = baseJql.slice(0, m.index).trim();
    orderBy = baseJql.slice(m.index).trim();
  }

  const clauses = [];
  if (where) clauses.push(`(${where})`);
  clauses.push(...extra);

  return clauses.join(' AND ') + (orderBy ? ` ${orderBy}` : '');
}

// Identifiants depuis la requête (config non encore enregistrée),
// avec repli sur la config en base. apiToken '***' = placeholder à ignorer.
async function resolveCredentials(body = {}) {
  let { instanceUrl, email, apiToken } = body;
  if (!instanceUrl || !email || !apiToken || apiToken === '***') {
    const config = await JiraConfig.findOne();
    if (config) {
      instanceUrl = instanceUrl || config.instanceUrl;
      email = email || config.email;
      apiToken = (apiToken && apiToken !== '***') ? apiToken : config.apiToken;
    }
  }
  return { instanceUrl, email, apiToken };
}

exports.getConfig = async (req, res) => {
  try {
    // No auth for now — matches other routes pattern
    const config = await JiraConfig.findOne().select('-apiToken');
    res.json({ success: true, config: config || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveConfig = async (req, res) => {
  try {
    const { instanceUrl, email, apiToken, projectKey, jql, storyPointsField, fields, dateField, dateFrom, dateTo, sprints } = req.body;
    if (!instanceUrl || !email || !apiToken) {
      return res.status(400).json({ success: false, message: 'instanceUrl, email et apiToken sont requis' });
    }

    const update = {
      instanceUrl,
      email,
      projectKey: projectKey || '',
      jql: (jql || '').trim(),
      storyPointsField: storyPointsField || 'customfield_10016',
      fields: Array.isArray(fields) ? fields : [],
      dateField: ALLOWED_DATE_FIELDS.includes(dateField) ? dateField : '',
      dateFrom: DATE_RE.test(dateFrom || '') ? dateFrom : '',
      dateTo: DATE_RE.test(dateTo || '') ? dateTo : '',
      sprints: Array.isArray(sprints)
        ? sprints.map(s => String(s).trim()).filter(s => /^\d+$/.test(s))
        : []
    };
    if (apiToken && apiToken !== '***') {
      update.apiToken = apiToken;
    }

    const config = await JiraConfig.findOneAndUpdate(
      {},
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, config: { ...config.toObject(), apiToken: '***' } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.testConnection = async (req, res) => {
  try {
    const { instanceUrl, email, apiToken } = req.body;
    if (!instanceUrl || !email || !apiToken) {
      return res.status(400).json({ success: false, message: 'instanceUrl, email et apiToken sont requis' });
    }

    const myself = await testConnection(instanceUrl, email, apiToken);
    res.json({ success: true, displayName: myself.displayName, email: myself.emailAddress });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const { instanceUrl, email, apiToken } = await resolveCredentials(req.body);
    if (!instanceUrl || !email || !apiToken) {
      return res.status(404).json({ success: false, message: 'Configuration Jira non trouvée' });
    }

    const result = await getProjects(instanceUrl, email, apiToken);
    const projects = (result.values || result).map(p => ({ key: p.key, name: p.name }));
    res.json({ success: true, projects });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Découverte des champs disponibles sur l'instance Jira (standard + personnalisés).
exports.getJiraFields = async (req, res) => {
  try {
    const { instanceUrl, email, apiToken } = await resolveCredentials(req.body);
    if (!instanceUrl || !email || !apiToken) {
      return res.status(400).json({ success: false, message: 'Identifiants Jira requis' });
    }

    const raw = await getFields(instanceUrl, email, apiToken);
    const fields = (raw || [])
      .map(f => ({
        id: f.id,
        name: f.name,
        custom: !!f.custom,
        type: f.schema?.type || undefined,
        isSprint: f.schema?.custom === 'com.pyxis.greenhopper.jira:gh-sprint'
      }))
      // Champs standard d'abord, puis tri alphabétique.
      .sort((a, b) => (Number(a.custom) - Number(b.custom)) || a.name.localeCompare(b.name));

    res.json({ success: true, fields });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Valide une JQL et renvoie le nombre d'issues correspondantes (bouton « Tester la JQL »).
exports.previewJql = async (req, res) => {
  try {
    const { instanceUrl, email, apiToken } = await resolveCredentials(req.body);
    if (!instanceUrl || !email || !apiToken) {
      return res.status(400).json({ success: false, message: 'Identifiants Jira requis' });
    }

    // Base = JQL personnalisée ou projet, puis on applique la borne temporelle.
    const baseJql = resolveJql({ jql: req.body.jql, projectKey: req.body.projectKey });
    if (!baseJql) return res.status(400).json({ success: false, message: 'JQL ou projet requis' });
    const jql = composeJql(baseJql, req.body);

    // Pour le simple comptage, on ne demande que 'summary'.
    const { issues, total } = await getAllIssues(instanceUrl, email, apiToken, jql, ['summary']);
    res.json({ success: true, total: total != null ? total : issues.length, jql });
  } catch (err) {
    // Erreur de syntaxe JQL renvoyée par Jira → 400 avec le message d'origine.
    res.status(400).json({ success: false, message: err.message });
  }
};

// Liste les sprints Jira d'un projet (pour pré-remplir un sprint interne).
exports.getJiraSprints = async (req, res) => {
  try {
    const { instanceUrl, email, apiToken } = await resolveCredentials(req.body);
    if (!instanceUrl || !email || !apiToken) {
      return res.status(400).json({ success: false, message: 'Identifiants Jira requis' });
    }

    let projectKey = (req.body.projectKey || '').trim();
    if (!projectKey) {
      const config = await JiraConfig.findOne();
      projectKey = (config && config.projectKey) || '';
    }
    if (!projectKey) {
      return res.status(400).json({ success: false, message: 'Aucun projet Jira sélectionné (requis pour lister les sprints)' });
    }

    const raw = await getProjectSprints(instanceUrl, email, apiToken, projectKey);
    const sprints = raw
      .map(s => ({
        id: s.id,
        name: s.name,
        state: s.state,
        startDate: s.startDate || null,
        endDate: s.endDate || null,
        boardName: s.boardName
      }))
      // Tri chronologique : plus récent d'abord, sprints sans date en dernier.
      .sort((a, b) => {
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return new Date(b.startDate) - new Date(a.startDate);
      });

    res.json({ success: true, sprints });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.syncFromJira = async (req, res) => {
  try {
    const config = await JiraConfig.findOne();
    if (!config) return res.status(404).json({ success: false, message: 'Configuration Jira non trouvée' });

    const baseJql = resolveJql(config);
    if (!baseJql) return res.status(400).json({ success: false, message: 'Aucun projet Jira ni JQL configuré' });
    const jql = composeJql(baseJql, config);

    // Load user status mappings
    const userMappings = await loadUserMappings();

    const fields = resolveSyncFields(config);

    const { issues, total } = await getAllIssues(
      config.instanceUrl, config.email, config.apiToken,
      jql, fields
    );

    const ops = issues.map(issue => {
      const epicData = issueToEpic(issue, config.storyPointsField, userMappings, config.instanceUrl, 'jira_api', fields);
      return {
        updateOne: {
          filter: { key: epicData.key },
          update: { $set: epicData },
          upsert: true
        }
      };
    });

    const result = ops.length > 0 ? await Epic.bulkWrite(ops) : { upsertedCount: 0, modifiedCount: 0 };

    const totalSP = issues.reduce((sum, issue) => sum + (issue.fields[config.storyPointsField] || 0), 0);

    config.lastSync = new Date();
    await config.save();

    res.json({
      success: true,
      total: issues.length,
      upserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
      totalStoryPoints: totalSP,
      lastSync: config.lastSync
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Import des issues récupérées par l'extension navigateur (session Jira de l'utilisateur).
 * Aucun token requis : l'extension a déjà appelé l'API Jira avec les cookies de session
 * et nous transmet le tableau d'issues brut (format /rest/api/3/search).
 *
 * Body attendu: { issues: [...], instanceUrl: string, storyPointsField?: string }
 */
exports.importFromSession = async (req, res) => {
  try {
    const { issues, instanceUrl, storyPointsField = 'customfield_10016' } = req.body;

    if (!Array.isArray(issues)) {
      return res.status(400).json({ success: false, message: 'Le champ "issues" (tableau) est requis' });
    }
    if (issues.length === 0) {
      return res.json({ success: true, total: 0, upserted: 0, modified: 0, totalStoryPoints: 0 });
    }

    const userMappings = await loadUserMappings();

    // Respecte la sélection de champs configurée (si présente).
    const config = await JiraConfig.findOne();
    const selectedFields = config ? resolveSyncFields(config) : null;

    const ops = issues.map(issue => {
      const epicData = issueToEpic(issue, storyPointsField, userMappings, instanceUrl, 'jira_session', selectedFields);
      return {
        updateOne: {
          filter: { key: epicData.key },
          update: { $set: epicData },
          upsert: true
        }
      };
    });

    const result = await Epic.bulkWrite(ops);

    const totalSP = issues.reduce((sum, issue) => sum + ((issue.fields || {})[storyPointsField] || 0), 0);

    // Met à jour lastSync si une config Jira existe (facultatif)
    const lastSync = new Date();
    await JiraConfig.updateOne({}, { $set: { lastSync } });

    res.json({
      success: true,
      total: issues.length,
      upserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
      totalStoryPoints: totalSP,
      lastSync
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
