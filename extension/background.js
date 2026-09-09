// Service worker MV3 — récupère les issues Jira via la session de l'utilisateur
// (cookies envoyés automatiquement grâce aux host_permissions) puis les POST vers POTool.

const ALARM_NAME = 'potool-jira-sync';

const DEFAULT_SETTINGS = {
  jiraBaseUrl: '',        // ex: https://monentreprise.atlassian.net
  projectKey: '',         // ex: PROJ  (ignoré si jql est renseigné)
  jql: '',                // JQL personnalisée (prioritaire sur projectKey)
  storyPointsField: 'customfield_10016',
  potoolUrl: 'http://localhost:3002',
  autoSync: false,
  intervalMinutes: 30
};

const ISSUE_FIELDS = [
  'summary', 'description', 'status', 'priority', 'assignee', 'reporter',
  'labels', 'duedate', 'created', 'issuetype', 'parent', 'project', 'resolution'
];

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

function buildJql(settings) {
  if (settings.jql && settings.jql.trim()) return settings.jql.trim();
  if (settings.projectKey && settings.projectKey.trim()) {
    return `project = "${settings.projectKey.trim()}" ORDER BY created DESC`;
  }
  throw new Error('Renseignez un "Project key" ou une JQL dans les réglages.');
}

function fields(settings) {
  return [...ISSUE_FIELDS, settings.storyPointsField].filter(Boolean);
}

// Endpoint moderne (Jira Cloud) : /rest/api/3/search/jql avec pagination par token.
async function fetchViaJqlEndpoint(base, jql, fieldList) {
  const all = [];
  let nextPageToken = null;
  do {
    const params = new URLSearchParams({
      jql,
      fields: fieldList.join(','),
      maxResults: '100'
    });
    if (nextPageToken) params.set('nextPageToken', nextPageToken);

    const res = await fetch(`${base}/rest/api/3/search/jql?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (res.status === 404 || res.status === 410) {
      const err = new Error('endpoint-not-found');
      err.code = 'FALLBACK';
      throw err;
    }
    if (!res.ok) throw new Error(`Jira a répondu ${res.status} (${res.statusText}). Êtes-vous connecté à Jira ?`);

    const data = await res.json();
    all.push(...(data.issues || []));
    nextPageToken = data.isLast ? null : data.nextPageToken;
  } while (nextPageToken);
  return all;
}

// Endpoint historique : /rest/api/3/search avec startAt/total.
async function fetchViaLegacyEndpoint(base, jql, fieldList) {
  const all = [];
  let startAt = 0;
  let total = null;
  do {
    const params = new URLSearchParams({
      jql,
      fields: fieldList.join(','),
      maxResults: '100',
      startAt: String(startAt)
    });
    const res = await fetch(`${base}/rest/api/3/search?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) throw new Error(`Jira a répondu ${res.status} (${res.statusText}). Êtes-vous connecté à Jira ?`);

    const data = await res.json();
    const batch = data.issues || [];
    all.push(...batch);
    total = data.total;
    startAt += batch.length;
    if (batch.length === 0) break;
  } while (startAt < total);
  return all;
}

async function fetchAllIssues(settings) {
  const base = settings.jiraBaseUrl.replace(/\/$/, '');
  if (!base) throw new Error('Renseignez l\'URL Jira dans les réglages.');
  const jql = buildJql(settings);
  const fieldList = fields(settings);

  try {
    return await fetchViaJqlEndpoint(base, jql, fieldList);
  } catch (e) {
    if (e.code === 'FALLBACK') {
      return await fetchViaLegacyEndpoint(base, jql, fieldList);
    }
    throw e;
  }
}

async function postToPotool(settings, issues) {
  const url = `${settings.potoolUrl.replace(/\/$/, '')}/api/jira/import-session`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issues,
      instanceUrl: settings.jiraBaseUrl,
      storyPointsField: settings.storyPointsField
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `POTool a répondu ${res.status}`);
  }
  return data;
}

async function runSync() {
  const startedAt = new Date().toISOString();
  try {
    const settings = await getSettings();
    const issues = await fetchAllIssues(settings);
    const result = await postToPotool(settings, issues);
    const status = {
      ok: true,
      at: startedAt,
      message: `${result.total} issue(s) synchronisée(s) — ${result.upserted} créée(s), ${result.modified} mise(s) à jour.`,
      result
    };
    await chrome.storage.local.set({ lastStatus: status });
    return status;
  } catch (err) {
    const status = { ok: false, at: startedAt, message: err.message };
    await chrome.storage.local.set({ lastStatus: status });
    return status;
  }
}

async function applySchedule() {
  await chrome.alarms.clear(ALARM_NAME);
  const settings = await getSettings();
  if (settings.autoSync) {
    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: Math.max(1, Number(settings.intervalMinutes) || 30)
    });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) runSync();
});

chrome.runtime.onInstalled.addListener(applySchedule);
chrome.runtime.onStartup.addListener(applySchedule);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SYNC_NOW') {
    runSync().then(sendResponse);
    return true; // réponse asynchrone
  }
  if (msg.type === 'APPLY_SCHEDULE') {
    applySchedule().then(() => sendResponse({ ok: true }));
    return true;
  }
});
