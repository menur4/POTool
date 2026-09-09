import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Input, Textarea, Spinner, useToast } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import {
  getJiraConfig,
  saveJiraConfig,
  testJiraConnection,
  getJiraProjects,
  getJiraFields,
  getJiraSprints,
  previewJiraJql
} from '../../services/jiraService';
import JiraFieldSelector from './JiraFieldSelector';
import './JiraConfigModal.css';

// Champs standard pré-cochés à la première configuration.
const DEFAULT_FIELD_IDS = [
  'summary', 'description', 'status', 'priority', 'issuetype',
  'labels', 'reporter', 'duedate', 'created', 'parent'
];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

const JiraConfigModal = ({ open, onClose, embedded = false }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    instanceUrl: '',
    email: '',
    apiToken: '',
    projectKey: '',
    jql: '',
    storyPointsField: 'customfield_10016',
    fields: [],
    dateField: '',
    dateFrom: '',
    dateTo: '',
    sprints: []
  });
  const [projects, setProjects] = useState([]);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testOk, setTestOk] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [testingJql, setTestingJql] = useState(false);
  const [jqlResult, setJqlResult] = useState(null); // { ok: boolean, message: string }
  const [availableFields, setAvailableFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [availableSprints, setAvailableSprints] = useState([]);
  const [loadingSprints, setLoadingSprints] = useState(false);

  const load = useCallback(async () => {
    try {
      const config = await getJiraConfig();
      if (config) {
        setForm({
          instanceUrl: config.instanceUrl || '',
          email: config.email || '',
          apiToken: '***',
          projectKey: config.projectKey || '',
          jql: config.jql || '',
          storyPointsField: config.storyPointsField || 'customfield_10016',
          fields: config.fields || [],
          dateField: config.dateField || '',
          dateFrom: config.dateFrom || '',
          dateTo: config.dateTo || '',
          sprints: config.sprints || []
        });
        setTestOk(true);
        loadProjectsList();
        loadFields();
      }
    } catch {
      // no config yet
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    // En mode intégré (onglet Configuration) la modale est toujours montée :
    // on charge la config immédiatement, sans dépendre d'un état `open`.
    if (open || embedded) load();
  }, [open, embedded, load]);

  const loadProjectsList = useCallback(async (credentials) => {
    setLoadingProjects(true);
    try {
      const list = await getJiraProjects(credentials);
      setProjects(list || []);
    } catch {
      // ignore — no config saved yet
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const loadFields = useCallback(async (credentials) => {
    setLoadingFields(true);
    try {
      const list = await getJiraFields(credentials);
      setAvailableFields(list || []);
      // Pré-sélection des champs standard si rien n'est encore choisi
      // (+ champ story points + champ Sprint détecté).
      setForm(f => {
        if (f.fields && f.fields.length) return f;
        const defaults = (list || [])
          .filter(x => DEFAULT_FIELD_IDS.includes(x.id) || x.id === f.storyPointsField || x.isSprint)
          .map(x => x.id);
        return { ...f, fields: defaults };
      });
    } catch {
      setAvailableFields([]);
    } finally {
      setLoadingFields(false);
    }
  }, []);

  const loadSprints = useCallback(async (payload) => {
    setLoadingSprints(true);
    try {
      const list = await getJiraSprints(payload);
      setAvailableSprints(list || []);
    } catch {
      setAvailableSprints([]);
    } finally {
      setLoadingSprints(false);
    }
  }, []);

  // Charge les sprints dès qu'un projet est sélectionné (connexion validée).
  useEffect(() => {
    if (testOk && form.projectKey) {
      loadSprints({
        instanceUrl: form.instanceUrl,
        email: form.email,
        apiToken: form.apiToken,
        projectKey: form.projectKey
      });
    } else {
      setAvailableSprints([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testOk, form.projectKey]);

  const handleChange = (name, value) => {
    setForm(f => ({ ...f, [name]: value }));
    if (name === 'instanceUrl' || name === 'email' || name === 'apiToken') {
      setTestOk(false);
      setProjects([]);
    }
    if (name === 'jql' || name === 'projectKey' || name === 'dateField' || name === 'dateFrom' || name === 'dateTo') {
      setJqlResult(null);
    }
  };

  const toggleSprint = (id) => {
    const sid = String(id);
    setForm(f => {
      const set = new Set((f.sprints || []).map(String));
      if (set.has(sid)) set.delete(sid);
      else set.add(sid);
      return { ...f, sprints: Array.from(set) };
    });
    setJqlResult(null);
  };

  const toggleField = (id) => {
    setForm(f => {
      const set = new Set(f.fields);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, fields: Array.from(set) };
    });
  };

  const handleTestJql = async () => {
    setTestingJql(true);
    setJqlResult(null);
    try {
      const res = await previewJiraJql({
        instanceUrl: form.instanceUrl,
        email: form.email,
        apiToken: form.apiToken,
        jql: form.jql,
        projectKey: form.projectKey,
        dateField: form.dateField,
        dateFrom: form.dateFrom,
        dateTo: form.dateTo,
        sprints: form.sprints,
        storyPointsField: form.storyPointsField
      });
      setJqlResult({ ok: true, message: t('jira.jqlValid', { total: res.total }) });
    } catch (err) {
      setJqlResult({ ok: false, message: t('jira.jqlInvalid', { error: err.response?.data?.message || err.message }) });
    } finally {
      setTestingJql(false);
    }
  };

  const handleTest = async () => {
    if (!form.instanceUrl || !form.email || !form.apiToken || form.apiToken === '***') {
      showToast({ type: 'warning', message: t('jira.fillCredentials') });
      return;
    }
    setTesting(true);
    setTestOk(false);
    try {
      const res = await testJiraConnection({ instanceUrl: form.instanceUrl, email: form.email, apiToken: form.apiToken });
      setTestOk(true);
      showToast({ type: 'success', message: t('jira.testSuccess', { name: res.displayName || res.email }) });
      const creds = { instanceUrl: form.instanceUrl, email: form.email, apiToken: form.apiToken };
      loadProjectsList(creds);
      loadFields(creds);
    } catch (err) {
      showToast({ type: 'error', message: t('jira.testError', { error: err.response?.data?.message || err.message }) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!form.instanceUrl || !form.email) {
      showToast({ type: 'warning', message: t('jira.fillCredentials') });
      return;
    }
    setSaving(true);
    try {
      await saveJiraConfig(form);
      showToast({ type: 'success', message: t('jira.configSaved') });
      if (onClose) onClose();
    } catch (err) {
      showToast({ type: 'error', message: t('jira.saveError', { error: err.response?.data?.message || err.message }) });
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="jira-config__footer">
      {!embedded && (
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
      )}
      <Button variant="primary" onClick={handleSave} loading={saving} disabled={!testOk}>
        {t('common.save')}
      </Button>
    </div>
  );

  const content = (
    <div className="jira-config">
        <div className="jira-config__section">
          <p className="jira-config__help">
            <i className="bi bi-info-circle" />
            {t('jira.configHelp')}
            {' '}
            <a
              href="https://id.atlassian.com/manage-profile/security/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('jira.generateToken')}
            </a>
          </p>

          <div className="jira-config__field">
            <label className="jira-config__label">{t('jira.instanceUrl')}</label>
            <Input
              value={form.instanceUrl}
              onChange={e => handleChange('instanceUrl', e.target.value)}
              placeholder="https://votre-instance.atlassian.net"
            />
          </div>

          <div className="jira-config__field">
            <label className="jira-config__label">{t('jira.email')}</label>
            <Input
              type="email"
              value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              placeholder={t('jira.emailPlaceholder')}
            />
          </div>

          <div className="jira-config__field">
            <label className="jira-config__label">{t('jira.apiToken')}</label>
            <div className="jira-config__token-row">
              <Input
                type="password"
                value={form.apiToken}
                onChange={e => handleChange('apiToken', e.target.value)}
                placeholder={t('jira.apiTokenPlaceholder')}
              />
              <Button
                variant="secondary"
                onClick={handleTest}
                loading={testing}
                className="jira-config__test-btn"
              >
                {testOk
                  ? <><i className="bi bi-check-circle-fill" /> {t('jira.connected')}</>
                  : t('jira.testConnection')
                }
              </Button>
            </div>
          </div>
        </div>

        {testOk && (
          <div className="jira-config__section">
            <div className="jira-config__field">
              <label className="jira-config__label">{t('jira.project')}</label>
              <select
                className="jira-config__select"
                value={form.projectKey}
                onChange={e => handleChange('projectKey', e.target.value)}
                disabled={loadingProjects}
              >
                <option value="">{loadingProjects ? t('common.loading') : t('jira.selectProject')}</option>
                {projects.map(p => (
                  <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
                ))}
              </select>
            </div>

            <div className="jira-config__field">
              <label className="jira-config__label">{t('jira.jql')}</label>
              <Textarea
                value={form.jql}
                onChange={e => handleChange('jql', e.target.value)}
                placeholder={t('jira.jqlPlaceholder')}
                rows={2}
              />
              <div className="jira-config__jql-row">
                <span className="jira-config__hint">{t('jira.jqlHint')}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTestJql}
                  loading={testingJql}
                  disabled={!form.jql?.trim() && !form.projectKey}
                >
                  {t('jira.testJql')}
                </Button>
              </div>
              {jqlResult && (
                <span className={`jira-config__jql-result jira-config__jql-result--${jqlResult.ok ? 'ok' : 'error'}`}>
                  <i className={`bi ${jqlResult.ok ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`} />
                  {' '}{jqlResult.message}
                </span>
              )}
            </div>

            <div className="jira-config__field">
              <label className="jira-config__label">{t('jira.timeRange')}</label>
              <span className="jira-config__hint">{t('jira.timeRangeHint')}</span>
              <div className="jira-config__date-row">
                <select
                  className="jira-config__select jira-config__date-field"
                  value={form.dateField}
                  onChange={e => handleChange('dateField', e.target.value)}
                >
                  <option value="">{t('jira.dateFieldNone')}</option>
                  <option value="created">{t('jira.dateFieldCreated')}</option>
                  <option value="updated">{t('jira.dateFieldUpdated')}</option>
                  <option value="resolved">{t('jira.dateFieldResolved')}</option>
                  <option value="duedate">{t('jira.dateFieldDue')}</option>
                </select>
                <div className="jira-config__date-input">
                  <label className="jira-config__date-label">{t('jira.dateFrom')}</label>
                  <Input
                    type="date"
                    value={form.dateFrom}
                    onChange={e => handleChange('dateFrom', e.target.value)}
                    disabled={!form.dateField}
                  />
                </div>
                <div className="jira-config__date-input">
                  <label className="jira-config__date-label">{t('jira.dateTo')}</label>
                  <Input
                    type="date"
                    value={form.dateTo}
                    onChange={e => handleChange('dateTo', e.target.value)}
                    disabled={!form.dateField}
                  />
                </div>
              </div>
            </div>

            <div className="jira-config__field">
              <label className="jira-config__label">{t('jira.sprintsFilter')}</label>
              <span className="jira-config__hint">{t('jira.sprintsFilterHint')}</span>
              {!form.projectKey ? (
                <span className="jira-config__hint">{t('jira.sprintsSelectProjectFirst')}</span>
              ) : loadingSprints ? (
                <Spinner />
              ) : availableSprints.length === 0 ? (
                <span className="jira-config__hint">{t('jira.noSprintsAvailable')}</span>
              ) : (
                <div className="jira-sprints__list">
                  {availableSprints.map(s => (
                    <label key={s.id} className="jira-sprints__item">
                      <input
                        type="checkbox"
                        checked={(form.sprints || []).map(String).includes(String(s.id))}
                        onChange={() => toggleSprint(s.id)}
                      />
                      <div className="jira-sprints__info">
                        <span className="jira-sprints__title">
                          {s.name}
                          <span className={`jira-sprints__badge jira-sprints__badge--${s.state}`}>
                            {t(`sprints.jiraState.${s.state}`, s.state)}
                          </span>
                        </span>
                        <span className="jira-sprints__meta">
                          #{s.id} · {fmtDate(s.startDate)} → {fmtDate(s.endDate)}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="jira-config__field">
              <label className="jira-config__label">{t('jira.storyPointsField')}</label>
              <Input
                value={form.storyPointsField}
                onChange={e => handleChange('storyPointsField', e.target.value)}
                placeholder="customfield_10016"
              />
              <span className="jira-config__hint">{t('jira.storyPointsFieldHint')}</span>
            </div>

            <div className="jira-config__field">
              <label className="jira-config__label">{t('jira.fields')}</label>
              <span className="jira-config__hint">{t('jira.fieldsHint')}</span>
              {loadingFields ? (
                <Spinner />
              ) : (
                <JiraFieldSelector
                  fields={availableFields}
                  selected={form.fields}
                  onToggle={toggleField}
                  storyPointsField={form.storyPointsField}
                />
              )}
            </div>
          </div>
        )}
      </div>
  );

  if (embedded) {
    return (
      <div className="jira-config-embedded">
        {content}
        <div className="jira-config-embedded__footer">{footer}</div>
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={t('jira.configTitle')} size="md" footer={footer}>
      {content}
    </Modal>
  );
};

export default JiraConfigModal;
