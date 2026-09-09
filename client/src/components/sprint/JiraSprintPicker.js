import React, { useState } from 'react';
import { Button } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import { getJiraSprints } from '../../services/jiraService';
import './JiraSprintPicker.css';

/**
 * Bouton « Pré-remplir depuis Jira » : charge à la demande la liste des sprints
 * Jira du projet configuré, puis affiche un select. À la sélection, appelle
 * onPick({ name, startDate, endDate }) pour pré-remplir le formulaire.
 */
const JiraSprintPicker = ({ onPick }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [sprints, setSprints] = useState(null); // null = pas encore chargé
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await getJiraSprints();
      setSprints(list || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setSprints([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (e) => {
    const id = e.target.value;
    if (!id) return;
    const sprint = sprints.find(s => String(s.id) === String(id));
    if (sprint) onPick(sprint);
  };

  return (
    <div className="jira-sprint-picker">
      {sprints === null ? (
        <Button variant="secondary" size="sm" onClick={load} loading={loading}>
          <i className="bi bi-cloud-download" /> {t('sprints.importFromJira')}
        </Button>
      ) : sprints.length > 0 ? (
        <select className="jira-sprint-picker__select" onChange={handleSelect} defaultValue="">
          <option value="">{t('sprints.selectJiraSprint')}</option>
          {sprints.map(s => (
            <option key={s.id} value={s.id}>
              [{t(`sprints.jiraState.${s.state}`, s.state)}] {s.name}
              {s.startDate ? ` — ${new Date(s.startDate).toLocaleDateString()}` : ''}
            </option>
          ))}
        </select>
      ) : (
        !error && <span className="jira-sprint-picker__hint">{t('sprints.noJiraSprints')}</span>
      )}
      {error && (
        <span className="jira-sprint-picker__error">
          <i className="bi bi-exclamation-triangle" /> {error}
        </span>
      )}
    </div>
  );
};

export default JiraSprintPicker;
