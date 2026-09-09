import React, { useState, useEffect } from 'react';
import { useToast } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import { getJiraSprints } from '../../services/jiraService';
import { linkSprintToJira } from '../../services/sprintService';
import './SprintJiraLinker.css';

/**
 * Icône Jira officielle (carré bleu + chevrons blancs), extraite du logo fourni.
 */
const JiraLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
    <path fill="#1868DB" d="M0,12C0,5.373 5.373,0 12,0L36,0C42.627,0 48,5.373 48,12L48,36C48,42.627 42.627,48 36,48L12,48C5.373,48 0,42.627 0,36L0,12Z" />
    <path fill="#fff" d="M17.948,31.047L15.243,31.047C11.164,31.047 8.238,28.548 8.238,24.89L22.78,24.89C23.534,24.89 24.022,25.425 24.022,26.184L24.022,40.818C20.386,40.818 17.948,37.873 17.948,33.768L17.948,31.047ZM25.13,23.774L22.426,23.774C18.347,23.774 15.42,21.321 15.42,17.662L29.963,17.662C30.717,17.662 31.249,18.153 31.249,18.911L31.249,33.545C27.613,33.545 25.13,30.601 25.13,26.496L25.13,23.774ZM32.357,16.547L29.653,16.547C25.574,16.547 22.647,14.048 22.647,10.39L37.19,10.39C37.944,10.39 38.432,10.925 38.432,11.639L38.432,26.273C34.796,26.273 32.357,23.328 32.357,19.224L32.357,16.547Z" />
  </svg>
);

/**
 * Lie le sprint interne courant à un sprint Jira, directement depuis la modale
 * d'édition. Charge la liste des sprints Jira (API Agile) à la demande, puis
 * appelle linkSprintToJira (pose le jiraId + rattache les tickets).
 *
 * @param {Object} sprint - sprint interne (_id, jiraId, name)
 * @param {Function} onLinked - callback après liaison (ex: recalcul des SP)
 */
const SprintJiraLinker = ({ sprint, onLinked }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [jiraSprints, setJiraSprints] = useState(null); // null = éditeur fermé
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selected, setSelected] = useState('');
  const [currentJiraId, setCurrentJiraId] = useState(sprint?.jiraId ?? null);
  const [currentName, setCurrentName] = useState('');

  useEffect(() => { setCurrentJiraId(sprint?.jiraId ?? null); }, [sprint?.jiraId]);

  const loadSprints = async () => {
    setLoading(true);
    try {
      const list = await getJiraSprints();
      setJiraSprints(list || []);
      const cur = (list || []).find((s) => String(s.id) === String(currentJiraId));
      if (cur) setCurrentName(cur.name);
      if (currentJiraId) setSelected(String(currentJiraId));
    } catch (e) {
      showToast({ type: 'error', message: e.response?.data?.message || e.message });
      setJiraSprints([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selected || !sprint?._id) return;
    setLinking(true);
    try {
      const res = await linkSprintToJira({ sprintId: sprint._id, jiraId: Number(selected) });
      setCurrentJiraId(Number(selected));
      const picked = (jiraSprints || []).find((s) => String(s.id) === String(selected));
      setCurrentName(picked ? picked.name : '');
      setJiraSprints(null);
      showToast({ type: 'success', message: t('sprints.jiraLink.linked', { count: res.linkedCount }) });
      if (onLinked) onLinked();
    } catch (e) {
      showToast({ type: 'error', message: e.response?.data?.message || e.message });
    } finally {
      setLinking(false);
    }
  };

  // Éditeur ouvert : sélection d'un sprint Jira
  if (jiraSprints !== null) {
    return (
      <div className="sjira-editor">
        <div className="sjira-editor__head">
          <JiraLogo size={14} />
          <span>{currentJiraId ? t('sprints.jiraLink.change', 'Changer l\'association Jira') : t('sprints.jiraLink.link', 'Associer à un sprint Jira')}</span>
        </div>
        <div className="sjira-editor__row">
          <select
            className="sjira-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">{t('sprints.jiraLink.selectSprint')}</option>
            {jiraSprints.map((s) => (
              <option key={s.id} value={s.id}>
                [{t(`sprints.jiraState.${s.state}`, s.state)}] {s.name}
                {s.startDate ? ` — ${new Date(s.startDate).toLocaleDateString()}` : ''}
              </option>
            ))}
          </select>
          <button type="button" className="sjira-confirm" disabled={!selected || linking} onClick={handleLink}>
            {linking ? '…' : t('sprints.jiraLink.confirm')}
          </button>
          <button type="button" className="sjira-cancel" onClick={() => setJiraSprints(null)}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    );
  }

  // État par défaut : bouton bleu Jira (lié ou à lier)
  return (
    <button
      type="button"
      className={`sjira-pill${currentJiraId ? ' sjira-pill--linked' : ''}`}
      onClick={loadSprints}
      disabled={loading}
      title={currentJiraId ? t('sprints.jiraLink.change', 'Changer l\'association') : t('sprints.jiraLink.link', 'Associer à Jira')}
    >
      <span className="sjira-pill__logo"><JiraLogo /></span>
      <span className="sjira-pill__text">
        {currentJiraId
          ? <>{t('sprints.jiraLink.linkedShort', 'Lié à Jira')} <b>#{currentJiraId}</b></>
          : t('sprints.jiraLink.link', 'Associer à Jira')}
      </span>
      {loading
        ? <span className="sjira-pill__spin" />
        : currentJiraId && <i className="bi bi-check-circle-fill sjira-pill__check" />}
    </button>
  );
};

export default SprintJiraLinker;
