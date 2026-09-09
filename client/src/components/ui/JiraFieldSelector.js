import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './JiraFieldSelector.css';

/**
 * Liste de champs Jira cochables, avec recherche.
 * Champs natifs (input) pour éviter les pièges de signature onChange.
 *
 * @param {Array} fields - [{ id, name, custom, type }]
 * @param {Array} selected - ids sélectionnés
 * @param {Function} onToggle - (id) => void
 * @param {string} storyPointsField - id du champ story points (badge SP)
 */
const JiraFieldSelector = ({ fields, selected, onToggle, storyPointsField }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter(f =>
      f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)
    );
  }, [fields, query]);

  if (!fields.length) {
    return <span className="jira-fields__empty">{t('jira.fieldsEmpty')}</span>;
  }

  return (
    <div className="jira-fields">
      <input
        className="jira-fields__search"
        type="text"
        placeholder={t('jira.fieldsSearch')}
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <div className="jira-fields__count">
        {selected.length} {t('jira.fieldsSelected')}
      </div>
      <div className="jira-fields__list">
        {filtered.map(f => (
          <label key={f.id} className="jira-fields__item">
            <input
              type="checkbox"
              checked={selectedSet.has(f.id)}
              onChange={() => onToggle(f.id)}
            />
            <span className="jira-fields__name">{f.name}</span>
            {f.id === storyPointsField && (
              <span className="jira-fields__badge">SP</span>
            )}
            {f.isSprint && (
              <span className="jira-fields__badge jira-fields__badge--sprint">sprint</span>
            )}
            {f.custom && !f.isSprint && (
              <span className="jira-fields__badge jira-fields__badge--custom">custom</span>
            )}
            <span className="jira-fields__id">{f.id}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default JiraFieldSelector;
