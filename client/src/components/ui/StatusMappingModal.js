import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Input, useToast } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import {
  getStatusMappings,
  upsertStatusMapping,
  deleteStatusMapping,
  getKnownStatuses
} from '../../services/statusMappingService';
import './StatusMappingModal.css';

const INTERNAL_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'];

const StatusMappingModal = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [mappings, setMappings] = useState([]);
  const [knownStatuses, setKnownStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newJiraStatus, setNewJiraStatus] = useState('');
  const [newInternalStatus, setNewInternalStatus] = useState('done');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mappingsRes, knownRes] = await Promise.all([
        getStatusMappings(),
        getKnownStatuses()
      ]);
      setMappings(mappingsRes.data || []);
      setKnownStatuses(knownRes.data || []);
    } catch {
      showToast({ type: 'error', message: t('statusMapping.loadError') });
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleAdd = async () => {
    if (!newJiraStatus.trim()) return;
    setSaving(true);
    try {
      const result = await upsertStatusMapping(newJiraStatus.trim(), newInternalStatus);
      const count = result?.updatedEpics ?? 0;
      showToast({
        type: 'success',
        message: count > 0
          ? t('statusMapping.addSuccess', { count })
          : t('statusMapping.addSuccessNoItems')
      });
      setNewJiraStatus('');
      setNewInternalStatus('done');
      load();
    } catch {
      showToast({ type: 'error', message: t('statusMapping.saveError') });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const result = await deleteStatusMapping(id);
      const count = result?.updatedEpics ?? 0;
      showToast({
        type: 'success',
        message: count > 0
          ? t('statusMapping.deleteSuccess', { count })
          : t('statusMapping.deleteSuccessNoItems')
      });
      load();
    } catch {
      showToast({ type: 'error', message: t('statusMapping.deleteError') });
    }
  };

  // Statuts connus non encore mappés (pour la datalist)
  const mappedJiraStatuses = mappings.map(m => m.jiraStatus.toLowerCase());
  const unmappedKnown = knownStatuses.filter(
    s => !mappedJiraStatuses.includes(s.toLowerCase())
  );

  const getMappingForStatus = (s) =>
    mappings.find(m => m.jiraStatus.toLowerCase() === s.toLowerCase());

  const internalStatusLabel = (s) =>
    t(`epics.status${s.charAt(0).toUpperCase() + s.slice(1).replace('_', '')}`, s);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('statusMapping.title')}
      size="md"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>
        </div>
      }
    >
      <div className="status-mapping-modal">
        {/* Statuts Jira découverts en base */}
        {!loading && knownStatuses.length > 0 && (
          <div className="status-mapping-modal__discovered">
            <p className="status-mapping-modal__discovered-title">
              {t('statusMapping.discoveredStatuses')}
            </p>
            <div className="status-mapping-modal__chips">
              {knownStatuses.map(s => {
                const mapping = getMappingForStatus(s);
                return (
                  <button
                    key={s}
                    className={`status-mapping-modal__chip${mapping ? ' status-mapping-modal__chip--mapped' : ''}`}
                    onClick={() => setNewJiraStatus(s)}
                    title={mapping
                      ? `${s} → ${internalStatusLabel(mapping.internalStatus)} — ${t('statusMapping.clickToRemap')}`
                      : t('statusMapping.clickToMap')}
                  >
                    <span className="status-mapping-modal__chip-label">{s}</span>
                    {mapping && (
                      <span className={`status-mapping-modal__chip-badge status-mapping-modal__badge--${mapping.internalStatus}`}>
                        {internalStatusLabel(mapping.internalStatus)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Liste des mappings existants */}
        <div className="status-mapping-modal__section">
          {loading ? (
            <p className="status-mapping-modal__empty">{t('common.loading')}</p>
          ) : mappings.length === 0 ? (
            <p className="status-mapping-modal__empty">{t('statusMapping.noMappings')}</p>
          ) : (
            <table className="status-mapping-modal__table">
              <thead>
                <tr>
                  <th>{t('statusMapping.jiraStatus')}</th>
                  <th></th>
                  <th>{t('statusMapping.internalStatus')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mappings.map(m => (
                  <tr key={m._id}>
                    <td className="status-mapping-modal__jira-cell">{m.jiraStatus}</td>
                    <td className="status-mapping-modal__arrow">→</td>
                    <td>
                      <span className={`status-mapping-modal__badge status-mapping-modal__badge--${m.internalStatus}`}>
                        {internalStatusLabel(m.internalStatus)}
                      </span>
                    </td>
                    <td>
                      <button
                        className="status-mapping-modal__delete-btn"
                        onClick={() => handleDelete(m._id)}
                        title={t('common.delete')}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Formulaire d'ajout */}
        <div className="status-mapping-modal__add-section">
          <h4 className="status-mapping-modal__add-title">{t('statusMapping.addMapping')}</h4>
          <div className="status-mapping-modal__add-form">
            <div className="status-mapping-modal__input-wrapper">
              <Input
                value={newJiraStatus}
                onChange={e => setNewJiraStatus(e.target.value)}
                placeholder={t('statusMapping.addPlaceholder')}
                list="known-statuses-list"
                fullWidth
              />
              {unmappedKnown.length > 0 && (
                <datalist id="known-statuses-list">
                  {unmappedKnown.map(s => <option key={s} value={s} />)}
                </datalist>
              )}
            </div>
            <span className="status-mapping-modal__form-arrow">→</span>
            <select
              className="status-mapping-modal__select"
              value={newInternalStatus}
              onChange={e => setNewInternalStatus(e.target.value)}
            >
              {INTERNAL_STATUSES.map(s => (
                <option key={s} value={s}>
                  {internalStatusLabel(s)}
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              onClick={handleAdd}
              disabled={!newJiraStatus.trim() || saving}
              loading={saving}
            >
              {t('statusMapping.add')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default StatusMappingModal;
