const FIELDS = ['jiraBaseUrl', 'projectKey', 'jql', 'storyPointsField', 'potoolUrl', 'intervalMinutes'];
const DEFAULTS = {
  jiraBaseUrl: '',
  projectKey: '',
  jql: '',
  storyPointsField: 'customfield_10016',
  potoolUrl: 'http://localhost:3002',
  autoSync: false,
  intervalMinutes: 30
};

const $ = (id) => document.getElementById(id);

function showStatus(text, kind) {
  const el = $('status');
  el.textContent = text;
  el.className = `status ${kind}`;
}

async function load() {
  const s = await chrome.storage.sync.get(DEFAULTS);
  FIELDS.forEach((f) => { $(f).value = s[f] ?? DEFAULTS[f]; });
  $('autoSync').checked = !!s.autoSync;

  const { lastStatus } = await chrome.storage.local.get('lastStatus');
  if (lastStatus) {
    const when = new Date(lastStatus.at).toLocaleString('fr-FR');
    showStatus(`${lastStatus.message} (${when})`, lastStatus.ok ? 'ok' : 'err');
  }
}

async function save() {
  const data = { autoSync: $('autoSync').checked };
  FIELDS.forEach((f) => { data[f] = $(f).value.trim(); });
  data.intervalMinutes = Number(data.intervalMinutes) || 30;
  await chrome.storage.sync.set(data);
  await chrome.runtime.sendMessage({ type: 'APPLY_SCHEDULE' });
  showStatus('Réglages enregistrés.', 'info');
}

async function syncNow() {
  await save();
  $('syncNow').disabled = true;
  showStatus('Synchronisation en cours…', 'info');
  const status = await chrome.runtime.sendMessage({ type: 'SYNC_NOW' });
  $('syncNow').disabled = false;
  if (status) showStatus(status.message, status.ok ? 'ok' : 'err');
}

document.addEventListener('DOMContentLoaded', load);
$('save').addEventListener('click', save);
$('syncNow').addEventListener('click', syncNow);
