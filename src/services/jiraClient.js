const https = require('https');
const http = require('http');
const { URL } = require('url');

function jiraRequest(instanceUrl, email, apiToken, path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const base = instanceUrl.replace(/\/$/, '');
    const url = new URL(`${base}${path}`);
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    // En entreprise, un proxy peut intercepter le HTTPS avec une autorité racine interne.
    // Voie sécurisée : pointer Node sur le CA via NODE_EXTRA_CA_CERTS (aucun code requis).
    // Dépannage : JIRA_INSECURE_TLS=true désactive la vérification du certificat.
    if (url.protocol === 'https:' && process.env.JIRA_INSECURE_TLS === 'true') {
      options.rejectUnauthorized = false;
    }

    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        // Erreurs HTTP : extraire le meilleur message possible.
        if (res.statusCode >= 400) {
          let message = `HTTP ${res.statusCode}`;
          try {
            const p = JSON.parse(data);
            message = (p.errorMessages && p.errorMessages.join(', ')) ||
                      p.message ||
                      (p.errors && Object.values(p.errors).join(', ')) ||
                      message;
          } catch { /* corps non JSON */ }
          const err = new Error(message);
          err.statusCode = res.statusCode;
          return reject(err);
        }
        // Succès sans corps (ex: 204 No Content sur un PUT).
        if (!data) return resolve({});
        try {
          resolve(JSON.parse(data));
        } catch {
          const err = new Error(`Invalid JSON response (HTTP ${res.statusCode})`);
          err.statusCode = res.statusCode;
          reject(err);
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function testConnection(instanceUrl, email, apiToken) {
  return jiraRequest(instanceUrl, email, apiToken, '/rest/api/3/myself');
}

// Met à jour les labels d'une issue Jira en mode incrémental (add/remove),
// ce qui préserve les labels non gérés par l'application.
async function updateIssueLabels(instanceUrl, email, apiToken, issueKey, { add = [], remove = [] }) {
  const ops = [
    ...add.map(label => ({ add: label })),
    ...remove.map(label => ({ remove: label }))
  ];
  if (!ops.length) return { skipped: true };
  return jiraRequest(
    instanceUrl, email, apiToken,
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
    'PUT',
    { update: { labels: ops } }
  );
}

// --- API Agile (boards & sprints) : /rest/agile/1.0 ---

async function getBoards(instanceUrl, email, apiToken, projectKeyOrId) {
  const query = projectKeyOrId
    ? `?projectKeyOrId=${encodeURIComponent(projectKeyOrId)}&maxResults=50`
    : '?maxResults=50';
  const res = await jiraRequest(instanceUrl, email, apiToken, `/rest/agile/1.0/board${query}`);
  return res.values || [];
}

async function getBoardSprints(instanceUrl, email, apiToken, boardId) {
  let all = [];
  let startAt = 0;
  let isLast = false;
  do {
    const path = `/rest/agile/1.0/board/${boardId}/sprint?startAt=${startAt}&maxResults=50`;
    const res = await jiraRequest(instanceUrl, email, apiToken, path);
    const batch = res.values || [];
    all = all.concat(batch);
    isLast = res.isLast;
    startAt += batch.length;
    if (batch.length === 0) break;
  } while (!isLast);
  return all;
}

// Récupère tous les sprints des boards d'un projet (dédupliqués).
async function getProjectSprints(instanceUrl, email, apiToken, projectKeyOrId) {
  const boards = await getBoards(instanceUrl, email, apiToken, projectKeyOrId);
  const byId = new Map();
  for (const board of boards) {
    try {
      const sprints = await getBoardSprints(instanceUrl, email, apiToken, board.id);
      sprints.forEach(s => {
        if (!byId.has(s.id)) byId.set(s.id, { ...s, boardName: board.name });
      });
    } catch (e) {
      // Les boards Kanban ne supportent pas les sprints → on les ignore.
    }
  }
  return Array.from(byId.values());
}

async function getProjects(instanceUrl, email, apiToken) {
  return jiraRequest(instanceUrl, email, apiToken, '/rest/api/3/project/search?maxResults=50&orderBy=key');
}

// Liste tous les champs disponibles sur l'instance (standard + personnalisés).
async function getFields(instanceUrl, email, apiToken) {
  return jiraRequest(instanceUrl, email, apiToken, '/rest/api/3/field');
}

function buildFieldsParam(fields) {
  const list = (Array.isArray(fields) && fields.length) ? fields : ['summary'];
  // 'summary' toujours présent (titre obligatoire côté Epic).
  if (!list.includes('summary')) list.push('summary');
  return list.join(',');
}

// Endpoint moderne (Jira Cloud) : /rest/api/3/search/jql, pagination par nextPageToken.
async function getAllIssuesJql(instanceUrl, email, apiToken, jql, fields) {
  const fieldsParam = buildFieldsParam(fields);
  const encodedJql = encodeURIComponent(jql);
  let allIssues = [];
  let nextPageToken = null;

  do {
    const tokenParam = nextPageToken ? `&nextPageToken=${encodeURIComponent(nextPageToken)}` : '';
    const path = `/rest/api/3/search/jql?jql=${encodedJql}&fields=${fieldsParam}&maxResults=100${tokenParam}`;
    const result = await jiraRequest(instanceUrl, email, apiToken, path);
    allIssues = allIssues.concat(result.issues || []);
    nextPageToken = result.isLast ? null : result.nextPageToken;
  } while (nextPageToken);

  return { issues: allIssues, total: allIssues.length };
}

// Endpoint historique : /rest/api/3/search, pagination par startAt/total.
async function getAllIssuesLegacy(instanceUrl, email, apiToken, jql, fields) {
  const fieldsParam = buildFieldsParam(fields);
  const encodedJql = encodeURIComponent(jql);
  let allIssues = [];
  let startAt = 0;
  let total = null;

  do {
    const path = `/rest/api/3/search?jql=${encodedJql}&fields=${fieldsParam}&maxResults=100&startAt=${startAt}`;
    const result = await jiraRequest(instanceUrl, email, apiToken, path);
    const batch = result.issues || [];
    allIssues = allIssues.concat(batch);
    total = result.total;
    startAt += batch.length;
    if (batch.length === 0) break;
  } while (startAt < total);

  return { issues: allIssues, total };
}

async function getAllIssues(instanceUrl, email, apiToken, jql, fields) {
  try {
    return await getAllIssuesJql(instanceUrl, email, apiToken, jql, fields);
  } catch (err) {
    // L'endpoint moderne n'existe pas sur certaines versions → repli sur l'historique.
    if (err.statusCode === 404 || err.statusCode === 410) {
      return await getAllIssuesLegacy(instanceUrl, email, apiToken, jql, fields);
    }
    throw err;
  }
}

module.exports = { testConnection, getProjects, getFields, getAllIssues, getProjectSprints, updateIssueLabels };
