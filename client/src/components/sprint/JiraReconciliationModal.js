import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Badge, Spinner, useToast } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import {
  getJiraReconciliation,
  createSprintFromJira,
  linkSprintToJira,
  getSprints
} from '../../services/sprintService';
import './JiraReconciliationModal.css';

const fmt = (d) => (d ? new Date(d).toLocaleDateString() : '—');

/**
 * Panneau de réconciliation des sprints Jira (vus sur les tickets) avec les
 * sprints internes. Permet de créer un sprint interne depuis Jira ou de lier
 * un sprint existant, en rattachant les tickets concernés.
 */
const JiraReconciliationModal = ({ open, onClose, onChanged }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [internalSprints, setInternalSprints] = useState([]); // sprints internes non encore liés

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, sprintsRes] = await Promise.all([getJiraReconciliation(), getSprints()]);
      setItems(res.items || []);
      // Sprints internes non liés (jiraId absent) → cibles possibles pour un lien manuel
      setInternalSprints((sprintsRes.data || []).filter(s => s.jiraId == null));
      if (res.jiraError) {
        showToast({ type: 'warning', message: t('sprints.reconcile.jiraUnavailable', { error: res.jiraError }) });
      }
    } catch (e) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  // Lien manuel : associe un sprint Jira à un sprint interne choisi
  const handleManualLink = async (item, sprintId) => {
    if (!sprintId) return;
    setBusyId(item.jiraId);
    try {
      const res = await linkSprintToJira({ sprintId, jiraId: item.jiraId });
      showToast({ type: 'success', message: t('sprints.reconcile.linked', { name: item.name, count: res.linkedCount }) });
      if (onChanged) onChanged();
      load();
    } catch (e) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleCreate = async (item) => {
    setBusyId(item.jiraId);
    try {
      const res = await createSprintFromJira({
        jiraId: item.jiraId,
        name: item.name,
        startDate: item.startDate,
        endDate: item.endDate
      });
      showToast({ type: 'success', message: t('sprints.reconcile.created', { name: item.name, count: res.linkedCount }) });
      if (onChanged) onChanged();
      load();
    } catch (e) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleLink = async (item) => {
    setBusyId(item.jiraId);
    try {
      const res = await linkSprintToJira({ sprintId: item.suggestion._id, jiraId: item.jiraId });
      showToast({ type: 'success', message: t('sprints.reconcile.linked', { name: item.suggestion.name, count: res.linkedCount }) });
      if (onChanged) onChanged();
      load();
    } catch (e) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (status) => {
    if (status === 'linked') return <Badge variant="success" size="sm" rounded>{t('sprints.reconcile.statusLinked')}</Badge>;
    if (status === 'suggested') return <Badge variant="warning" size="sm" rounded>{t('sprints.reconcile.statusSuggested')}</Badge>;
    return <Badge variant="default" size="sm" rounded>{t('sprints.reconcile.statusMissing')}</Badge>;
  };

  return (
    <Modal open={open} onClose={onClose} title={t('sprints.reconcile.title')} size="lg">
      <div className="jira-reconcile">
        <p className="jira-reconcile__hint">{t('sprints.reconcile.hint')}</p>

        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <div className="jira-reconcile__empty">{t('sprints.reconcile.empty')}</div>
        ) : (
          <div className="jira-reconcile__list">
            {items.map(item => (
              <div key={item.jiraId} className="jira-reconcile__item">
                <div className="jira-reconcile__info">
                  <div className="jira-reconcile__name">
                    {item.name} {statusBadge(item.status)}
                  </div>
                  <div className="jira-reconcile__meta">
                    #{item.jiraId} · {fmt(item.startDate)} → {fmt(item.endDate)} · {t('sprints.reconcile.tickets', { count: item.ticketCount })}
                  </div>
                  {item.status === 'linked' && (
                    <div className="jira-reconcile__sub">{t('sprints.reconcile.linkedTo', { name: item.internalSprint?.name })}</div>
                  )}
                  {item.status === 'suggested' && (
                    <div className="jira-reconcile__sub">{t('sprints.reconcile.suggestion', { name: item.suggestion?.name })}</div>
                  )}
                </div>
                <div className="jira-reconcile__actions">
                  {item.status === 'suggested' && (
                    <Button variant="secondary" size="sm" loading={busyId === item.jiraId} onClick={() => handleLink(item)}>
                      {t('sprints.reconcile.link')}
                    </Button>
                  )}
                  {item.status !== 'linked' && (
                    <>
                      {/* Lien manuel vers un sprint interne existant (noms différents) */}
                      <select
                        className="jira-reconcile__link-select"
                        defaultValue=""
                        disabled={busyId === item.jiraId || internalSprints.length === 0}
                        onChange={(e) => handleManualLink(item, e.target.value)}
                      >
                        <option value="">{t('sprints.reconcile.linkToExisting')}</option>
                        {internalSprints.map(s => (
                          <option key={s._id} value={s._id}>{s.name}</option>
                        ))}
                      </select>
                      {item.status === 'missing' && (
                        <Button
                          variant="primary"
                          size="sm"
                          loading={busyId === item.jiraId}
                          disabled={!item.startDate || !item.endDate}
                          title={(!item.startDate || !item.endDate) ? t('sprints.reconcile.noDates') : undefined}
                          onClick={() => handleCreate(item)}
                        >
                          {t('sprints.reconcile.create')}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default JiraReconciliationModal;
