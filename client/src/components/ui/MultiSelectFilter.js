import React, { useState, useRef, useEffect } from 'react';
import './MultiSelectFilter.css';

/**
 * Dropdown multi-select with checkboxes.
 * Props:
 *   options    [{value, label}]
 *   value      [selectedValue, ...]
 *   onChange   (newValues) => void
 *   placeholder string
 *   maxLabelItems number (default 2) – max sprint names shown in label before "N sprints"
 */
const MultiSelectFilter = ({ options = [], value = [], onChange, placeholder = 'Sélectionner...', maxLabelItems = 2 }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (optionValue) => {
    const next = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(next);
  };

  const clearAll = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  // Build trigger label
  const triggerLabel = () => {
    if (value.length === 0) return placeholder;
    const selected = options.filter(o => value.includes(o.value));
    if (selected.length <= maxLabelItems) {
      return selected.map(o => o.label).join(', ');
    }
    return `${selected.length} sélectionnés`;
  };

  const hasSelection = value.length > 0;

  return (
    <div className={`multi-select-filter ${open ? 'multi-select-filter--open' : ''}`} ref={containerRef}>
      <button
        type="button"
        className={`multi-select-filter__trigger ${hasSelection ? 'multi-select-filter__trigger--active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="multi-select-filter__label">{triggerLabel()}</span>
        {hasSelection && (
          <span className="multi-select-filter__count">{value.length}</span>
        )}
        {hasSelection ? (
          <i
            className="bi bi-x-circle-fill multi-select-filter__clear"
            onClick={clearAll}
            title="Vider la sélection"
          />
        ) : (
          <i className={`bi bi-chevron-down multi-select-filter__caret ${open ? 'multi-select-filter__caret--open' : ''}`} />
        )}
      </button>

      {open && (
        <div className="multi-select-filter__dropdown" role="listbox" aria-multiselectable="true">
          {options.length === 0 ? (
            <div className="multi-select-filter__empty">Aucune option</div>
          ) : (
            options.map(option => {
              const checked = value.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={`multi-select-filter__item ${checked ? 'multi-select-filter__item--checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="multi-select-filter__checkbox"
                    checked={checked}
                    onChange={() => toggle(option.value)}
                  />
                  <span className="multi-select-filter__item-label">{option.label}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelectFilter;
