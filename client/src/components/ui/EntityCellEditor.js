import React, { useState, useRef, useEffect } from 'react';
import { Badge } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import './EntityCellEditor.css';

/**
 * Édition inline de la valeur d'entité (entityLabels) directement dans le tableau.
 * Clic sur la cellule → champ texte avec autocomplétion (datalist).
 * Édite l'entité principale (1re) ; les autres labels éventuels sont préservés.
 *
 * @param {Object} row - ligne (epic) avec _id et entityLabels
 * @param {Array} availableLabels - [{ name, color }] pour l'autocomplétion + couleur
 * @param {Function} onSave - (row, entityLabels) => void
 */
const EntityCellEditor = ({ row, availableLabels = [], onSave }) => {
  const { t } = useTranslation();
  const labels = row.entityLabels || [];
  const primary = (labels[0] && (labels[0].name || labels[0])) || '';

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(primary);
  const inputRef = useRef(null);

  useEffect(() => { setValue(primary); }, [primary]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commit = () => {
    const trimmed = value.trim();
    setEditing(false);
    if (trimmed === primary) return; // pas de changement

    const rest = labels.slice(1);
    let next;
    if (!trimmed) {
      next = rest;
    } else {
      const match = availableLabels.find(l => l.name && l.name.toLowerCase() === trimmed.toLowerCase());
      const color = match?.color || (labels[0] && labels[0].color) || 'info';
      next = [{ name: trimmed, color }, ...rest];
    }
    onSave(row, next);
  };

  const cancel = () => { setValue(primary); setEditing(false); };

  if (editing) {
    const listId = `entity-options-${row._id || 'x'}`;
    return (
      <div className="entity-cell entity-cell--editing">
        <input
          ref={inputRef}
          className="entity-cell__input"
          list={listId}
          value={value}
          placeholder={t('epics.entityLabels')}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') cancel();
          }}
          onBlur={commit}
        />
        <datalist id={listId}>
          {availableLabels.map((l, i) => <option key={i} value={l.name} />)}
        </datalist>
      </div>
    );
  }

  return (
    <div
      className="entity-cell"
      onClick={() => setEditing(true)}
      title={t('common.edit')}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') setEditing(true); }}
    >
      {labels.length > 0 ? (
        <div className="epics-table__tags epics-table__tags--centered">
          {labels.map((label, idx) => (
            <Badge key={idx} variant={label.color || 'info'} size="sm" rounded gradient>
              {label.name || label}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="entity-cell__empty">—</span>
      )}
    </div>
  );
};

export default EntityCellEditor;
