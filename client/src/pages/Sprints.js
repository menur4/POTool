import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Spinner, useToast, FileUpload, Badge, Input, Modal } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import {
  getSprints,
  createSprint,
  updateSprint,
  deleteSprint,
  activateSprint,
  closeSprint,
  reopenSprint,
  calculateCapacity,
  syncAllDelivered,
  updateSprintDelivered
} from '../services/sprintService';
import { getTeamMembers } from '../services/teamMemberService';
import { previewImport, importEpics } from '../services/epicService';
import { SprintFormModal, CloseSprintModal } from '../components/sprint';
import JiraReconciliationModal from '../components/sprint/JiraReconciliationModal';
import { ConfirmationModal } from '../components/ui';
import '../styles/Sprints.css';

// Pastille « Jira » (icône officielle) affichée sur les sprints reliés à Jira.
const SprintJiraBadge = ({ jiraId }) => (
  <span className="sprints-table__jira" title={`Lié à Jira #${jiraId}`}>
    <svg width="13" height="13" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
      <path fill="#1868DB" d="M0,12C0,5.373 5.373,0 12,0L36,0C42.627,0 48,5.373 48,12L48,36C48,42.627 42.627,48 36,48L12,48C5.373,48 0,42.627 0,36L0,12Z" />
      <path fill="#fff" d="M17.948,31.047L15.243,31.047C11.164,31.047 8.238,28.548 8.238,24.89L22.78,24.89C23.534,24.89 24.022,25.425 24.022,26.184L24.022,40.818C20.386,40.818 17.948,37.873 17.948,33.768L17.948,31.047ZM25.13,23.774L22.426,23.774C18.347,23.774 15.42,21.321 15.42,17.662L29.963,17.662C30.717,17.662 31.249,18.153 31.249,18.911L31.249,33.545C27.613,33.545 25.13,30.601 25.13,26.496L25.13,23.774ZM32.357,16.547L29.653,16.547C25.574,16.547 22.647,14.048 22.647,10.39L37.19,10.39C37.944,10.39 38.432,10.925 38.432,11.639L38.432,26.273C34.796,26.273 32.357,23.328 32.357,19.224L32.357,16.547Z" />
    </svg>
    <span className="sprints-table__jira-id">#{jiraId}</span>
  </span>
);

const Sprints = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  // States
  const [sprints, setSprints] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Current sprint being edited/deleted
  const [currentSprint, setCurrentSprint] = useState(null);
  const [capacityPreview, setCapacityPreview] = useState(null);

  // Réconciliation Jira
  const [showReconcile, setShowReconcile] = useState(false);
  const [syncingDelivered, setSyncingDelivered] = useState(false);
  // Éditeur manuel du livré / capacité (backfill Excel)
  const [deliveredEditor, setDeliveredEditor] = useState(null);
  const [savingDelivered, setSavingDelivered] = useState(false);

  // Import states
  const [importSprint, setImportSprint] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importOptions, setImportOptions] = useState({
    sheetName: '',
    headerRow: 1,
    skipDuplicates: false
  });

  // Load data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sprintsRes, teamRes] = await Promise.all([
        getSprints(),
        getTeamMembers()
      ]);
      setSprints(sprintsRes.data || []);
      setTeamMembers(teamRes.data || []);
    } catch (error) {
      showToast({ type: 'error', message: error.message || t('sprints.loadError') });
    } finally {
      setLoading(false);
    }
  };

  // Backfill : synchronise le livré (SP) de tous les sprints clos depuis Jira.
  const handleSyncAllDelivered = async () => {
    setSyncingDelivered(true);
    try {
      const res = await syncAllDelivered();
      const { total = 0, updated = 0, results = [] } = res.data || {};
      const failed = results.filter((r) => !r.ok).length;
      showToast({
        type: failed ? 'warning' : 'success',
        message: t('sprints.syncDeliveredDone', {
          updated, total, failed,
          defaultValue: `Livré synchronisé : ${updated}/${total} sprints${failed ? ` (${failed} en échec)` : ''}`,
        }),
      });
      await fetchData();
    } catch (error) {
      showToast({ type: 'error', message: error.message || t('sprints.syncDeliveredError', 'Synchronisation du livré impossible') });
    } finally {
      setSyncingDelivered(false);
    }
  };

  // Éditeur manuel du livré / capacité
  const openDeliveredEditor = (sprint) => {
    setDeliveredEditor({
      sprint,
      deliveredStoryPoints: sprint.deliveredStoryPoints ?? 0,
      netCapacity: sprint.capacity?.actual ?? sprint.capacity?.planned ?? '',
    });
  };

  const handleSaveDelivered = async () => {
    if (!deliveredEditor) return;
    setSavingDelivered(true);
    try {
      await updateSprintDelivered(deliveredEditor.sprint._id, {
        deliveredStoryPoints: deliveredEditor.deliveredStoryPoints,
        netCapacity: deliveredEditor.netCapacity,
      });
      showToast({ type: 'success', message: t('sprints.deliveredSaved', 'Livré enregistré') });
      setDeliveredEditor(null);
      await fetchData();
    } catch (error) {
      showToast({ type: 'error', message: error.message || t('sprints.loadError') });
    } finally {
      setSavingDelivered(false);
    }
  };

  // Calculate capacity preview when form data changes
  const handleFormChange = useCallback(async (formData, filteredHolidays) => {
    if (formData.startDate && formData.endDate && formData.team?.length > 0) {
      try {
        const payload = {
          startDate: formData.startDate,
          endDate: formData.endDate,
          team: formData.team,
          constraints: formData.constraints,
        };
        if (filteredHolidays !== undefined) payload.holidays = filteredHolidays;
        const result = await calculateCapacity(payload);
        setCapacityPreview(result.data);
      } catch (error) {
        console.error('Capacity calculation error:', error);
        setCapacityPreview(null);
      }
    } else {
      setCapacityPreview(null);
    }
  }, []);

  // Open modal for creating a sprint
  const handleCreate = () => {
    setCurrentSprint(null);
    setCapacityPreview(null);
    setShowFormModal(true);
  };

  // Open modal for editing a sprint
  const handleEdit = (sprint) => {
    setCurrentSprint(sprint);
    setShowFormModal(true);
  };

  // Submit form (create or update)
  const handleSubmit = async (formData, filteredHolidays) => {
    setSubmitting(true);
    const payload = filteredHolidays !== undefined
      ? { ...formData, holidays: filteredHolidays }
      : formData;
    try {
      if (currentSprint) {
        await updateSprint(currentSprint._id, payload);
        showToast({ type: 'success', message: t('sprints.updateSuccess') });
      } else {
        await createSprint(payload);
        showToast({ type: 'success', message: t('sprints.createSuccess') });
      }
      setShowFormModal(false);
      fetchData();
    } catch (error) {
      showToast({ type: 'error', message: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete a sprint
  const handleDelete = async () => {
    try {
      await deleteSprint(currentSprint._id);
      showToast({ type: 'success', message: t('sprints.deleteSuccess') });
      setShowDeleteModal(false);
      setCurrentSprint(null);
      fetchData();
    } catch (error) {
      showToast({ type: 'error', message: error.message });
    }
  };

  // Activate a sprint
  const handleActivate = async (sprint) => {
    try {
      await activateSprint(sprint._id);
      showToast({ type: 'success', message: t('sprints.activateSuccess') });
      fetchData();
    } catch (error) {
      showToast({ type: 'error', message: error.message });
    }
  };

  // Reopen a closed sprint (back to draft)
  const handleReopen = async (sprint) => {
    try {
      await reopenSprint(sprint._id);
      showToast({ type: 'success', message: t('sprints.reopenSuccess') });
      fetchData();
    } catch (error) {
      showToast({ type: 'error', message: error.message });
    }
  };

  // Close a sprint with enriched data
  const handleCloseSprint = async (closeData) => {
    setSubmitting(true);
    try {
      await closeSprint(currentSprint._id, closeData);
      showToast({ type: 'success', message: t('sprints.closeSuccess') });
      setShowCloseModal(false);
      setCurrentSprint(null);
      fetchData();
    } catch (error) {
      showToast({ type: 'error', message: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Open import modal for a sprint
  const handleOpenImport = (sprint) => {
    setImportSprint(sprint);
    setImportFile(null);
    setImportPreview(null);
    setLoadingPreview(false);
    setImportOptions({ sheetName: '', headerRow: 1, skipDuplicates: false });
    setShowImportModal(true);
  };

  // Handle import file selection
  const handleImportFileSelect = async (file) => {
    if (!file) return;

    setImportFile(file);
    setLoadingPreview(true);
    setImportPreview(null);
    try {
      const result = await previewImport(file, importOptions);
      if (result.success) {
        setImportPreview(result);
      } else {
        showToast({ type: 'error', message: result.message || t('epics.importPreviewError') });
      }
    } catch (error) {
      console.error('Preview error:', error);
      showToast({ type: 'error', message: error.message || t('epics.importPreviewError') });
    } finally {
      setLoadingPreview(false);
    }
  };

  // Confirm import
  const handleConfirmImport = async () => {
    if (!importFile || !importSprint) return;

    setImporting(true);
    try {
      const result = await importEpics(importFile, {
        ...importOptions,
        sprint: importSprint._id
      });
      if (result.success) {
        showToast({
          type: 'success',
          message: t('sprints.importSuccess', { count: result.data?.imported || 0 })
        });
        setShowImportModal(false);
        fetchData();
      } else {
        showToast({ type: 'error', message: result.message || t('sprints.importError') });
      }
    } catch (error) {
      showToast({ type: 'error', message: error.message || t('sprints.importError') });
    } finally {
      setImporting(false);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  // Compte les jours du lundi au vendredi entre deux dates (bornes incluses)
  const countWorkingDays = (start, end) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { variant: 'default', label: t('sprints.status.draft') },
      active: { variant: 'success', label: t('sprints.status.active') },
      closed: { variant: 'info', label: t('sprints.status.closed') }
    };
    const config = statusConfig[status] || statusConfig.draft;
    return (
      <Badge variant={config.variant} dot rounded size="sm">
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="sprints-page">
      {/* Header */}
      <div className="sprints-header">
        <div className="sprints-header__title">
          <h1>{t('sprints.title')}</h1>
          <p className="sprints-header__subtitle">{t('sprints.subtitle')}</p>
        </div>
        <div className="sprints-header__actions">
          <Button variant="secondary" onClick={handleSyncAllDelivered} loading={syncingDelivered}>
            <i className="bi bi-arrow-repeat me-2"></i>
            {t('sprints.syncDelivered', 'Synchroniser le livré (Jira)')}
          </Button>
          <Button variant="secondary" onClick={() => setShowReconcile(true)}>
            <i className="bi bi-arrow-left-right me-2"></i>
            {t('sprints.reconcile.button')}
          </Button>
          <Button variant="primary" onClick={handleCreate}>
            <i className="bi bi-plus-lg me-2"></i>
            {t('sprints.create')}
          </Button>
        </div>
      </div>

      {/* Sprint list */}
      <Card variant="elevated" padding="md" className="sprints-list">
        {loading ? (
          <div className="sprints-list__loading">
            <Spinner size="lg" />
            <p>{t('common.loading')}</p>
          </div>
        ) : sprints.length === 0 ? (
          <div className="sprints-list__empty">
            <i className="bi bi-calendar3"></i>
            <p>{t('sprints.noSprints')}</p>
            <Button variant="secondary" onClick={handleCreate}>
              <i className="bi bi-plus-lg me-2"></i>
              {t('sprints.createFirst')}
            </Button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table className="sprints-table">
            <thead>
              <tr>
                <th>{t('sprints.name')}</th>
                <th>{t('sprints.dates')}</th>
                <th>{t('sprints.team')}</th>
                <th>{t('sprints.capacity')}</th>
                <th>{t('sprints.velocity')}</th>
                <th>{t('sprints.status.label')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sprints.map(sprint => (
                <tr key={sprint._id}>
                  <td>
                    <div className="sprints-table__name">
                      <strong>{sprint.name}</strong>
                      {sprint.jiraId != null && <SprintJiraBadge jiraId={sprint.jiraId} />}
                    </div>
                    {sprint.goal && (
                      <div className="sprints-table__goal">{sprint.goal}</div>
                    )}
                  </td>
                  <td>
                    {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                    <div className="sprints-table__working-days">
                      <i className="bi bi-calendar-check"></i>
                      {sprint.capacity?.workingDays > 0
                        ? sprint.capacity.workingDays
                        : countWorkingDays(sprint.startDate, sprint.endDate)
                      } {t('sprints.workingDays')}
                    </div>
                  </td>
                  <td>
                    {sprint.team?.length || 0} {t('sprints.members')}
                  </td>
                  <td>
                    <div>{sprint.capacity?.planned?.toFixed(1) || 0} j</div>
                    {sprint.status === 'closed' && (
                      <div className="sprints-table__actual">
                        {t('sprints.actual')}: {sprint.capacity?.actual?.toFixed(1) || 0} j
                      </div>
                    )}
                  </td>
                  <td>
                    {sprint.status === 'closed' ? (
                      <>
                        <div>{sprint.velocity?.actual || 0} SP/j</div>
                        <div className="sprints-table__actual">
                          {sprint.deliveredStoryPoints || 0} SP
                        </div>
                      </>
                    ) : (
                      <div>-</div>
                    )}
                  </td>
                  <td>{getStatusBadge(sprint.status)}</td>
                  <td>
                    <div className="sprints-table__actions">
                      {sprint.status === 'draft' && (
                        <>
                          <button
                            className="sprints-table__action-btn sprints-table__action-btn--edit"
                            onClick={() => handleEdit(sprint)}
                            title={t('common.edit')}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="sprints-table__action-btn sprints-table__action-btn--import"
                            onClick={() => handleOpenImport(sprint)}
                            title={t('sprints.importReport')}
                          >
                            <i className="bi bi-upload"></i>
                          </button>
                          <button
                            className="sprints-table__action-btn sprints-table__action-btn--activate"
                            onClick={() => handleActivate(sprint)}
                            title={t('sprints.activate')}
                          >
                            <i className="bi bi-play-fill"></i>
                          </button>
                          <button
                            className="sprints-table__action-btn sprints-table__action-btn--close"
                            onClick={() => {
                              setCurrentSprint(sprint);
                              setShowCloseModal(true);
                            }}
                            title={t('sprints.closeDraft')}
                          >
                            <i className="bi bi-check-circle"></i>
                          </button>
                          <button
                            className="sprints-table__action-btn sprints-table__action-btn--delete"
                            onClick={() => {
                              setCurrentSprint(sprint);
                              setShowDeleteModal(true);
                            }}
                            title={t('common.delete')}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </>
                      )}
                      {sprint.status === 'active' && (
                        <>
                          <button
                            className="sprints-table__action-btn sprints-table__action-btn--edit"
                            onClick={() => handleEdit(sprint)}
                            title={t('common.edit')}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="sprints-table__action-btn sprints-table__action-btn--import"
                            onClick={() => handleOpenImport(sprint)}
                            title={t('sprints.importReport')}
                          >
                            <i className="bi bi-upload"></i>
                          </button>
                          <button
                            className="sprints-table__action-btn sprints-table__action-btn--close"
                            onClick={() => {
                              setCurrentSprint(sprint);
                              setShowCloseModal(true);
                            }}
                            title={t('sprints.close')}
                          >
                            <i className="bi bi-check-circle"></i>
                          </button>
                          <button
                            className="sprints-table__action-btn sprints-table__action-btn--delete"
                            onClick={() => {
                              setCurrentSprint(sprint);
                              setShowDeleteModal(true);
                            }}
                            title={t('common.delete')}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </>
                      )}
                      {sprint.status === 'closed' && (
                        <>
                          <button
                            className="sprints-table__action-btn sprints-table__action-btn--view"
                            onClick={() => handleEdit(sprint)}
                            title={t('common.view')}
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          <button
                            className="sprints-table__action-btn"
                            onClick={() => openDeliveredEditor(sprint)}
                            title={t('sprints.editDelivered', 'Saisir le livré / la capacité')}
                          >
                            <i className="bi bi-pencil-square"></i>
                          </button>
                          <button
                            className="sprints-table__action-btn sprints-table__action-btn--activate"
                            onClick={() => handleReopen(sprint)}
                            title={t('sprints.reopen')}
                          >
                            <i className="bi bi-arrow-counterclockwise"></i>
                          </button>
                          <button
                            className="sprints-table__action-btn sprints-table__action-btn--delete"
                            onClick={() => {
                              setCurrentSprint(sprint);
                              setShowDeleteModal(true);
                            }}
                            title={t('common.delete')}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {/* Sprint Form Modal (Create/Edit) */}
      <SprintFormModal
        open={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSubmit={handleSubmit}
        sprint={currentSprint}
        sprints={sprints}
        teamMembers={teamMembers}
        capacityPreview={capacityPreview}
        onFormChange={handleFormChange}
        loading={submitting}
      />

      {/* Réconciliation Jira */}
      <JiraReconciliationModal
        open={showReconcile}
        onClose={() => setShowReconcile(false)}
        onChanged={fetchData}
      />

      {/* Éditeur manuel du livré / capacité (backfill Excel) */}
      <Modal
        open={!!deliveredEditor}
        onClose={() => setDeliveredEditor(null)}
        title={deliveredEditor ? `${t('sprints.editDelivered', 'Saisir le livré / la capacité')} — ${deliveredEditor.sprint.name}` : ''}
        size="sm"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="ghost" onClick={() => setDeliveredEditor(null)} disabled={savingDelivered}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSaveDelivered} loading={savingDelivered}>
              {t('common.save')}
            </Button>
          </div>
        }
      >
        {deliveredEditor && (() => {
          const sp = Number(deliveredEditor.deliveredStoryPoints) || 0;
          const net = Number(deliveredEditor.netCapacity) || 0;
          const vel = net > 0 ? Math.round((sp / net) * 100) / 100 : null;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-color-text-secondary, #6B6459)' }}>
                {t('sprints.editDeliveredHint', 'Saisissez les valeurs de votre fichier. La vélocité (SP/jour) est recalculée automatiquement.')}
              </p>
              <Input
                label={t('sprints.closeSprint.deliveredSP', 'Story points livrés')}
                type="number"
                min={0}
                value={deliveredEditor.deliveredStoryPoints}
                onChange={(e) => setDeliveredEditor((d) => ({ ...d, deliveredStoryPoints: e.target.value }))}
                fullWidth
              />
              <Input
                label={t('sprints.netCapacityDays', 'Capacité nette (jours)')}
                type="number"
                min={0}
                step="0.1"
                value={deliveredEditor.netCapacity}
                onChange={(e) => setDeliveredEditor((d) => ({ ...d, netCapacity: e.target.value }))}
                fullWidth
              />
              <div style={{ fontSize: 14 }}>
                {t('sprints.velocity', 'Vélocité')} :{' '}
                <strong>{vel != null ? `${vel} ${t('sprints.closeSprint.velocityUnit', 'SP/jour')}` : '—'}</strong>
                {vel == null && (
                  <span style={{ color: 'var(--ds-color-text-muted, #A69E90)', marginLeft: 6 }}>
                    ({t('sprints.velocityNeedsCapacity', 'renseignez la capacité')})
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title={t('sprints.deleteConfirmTitle')}
        message={t('sprints.deleteConfirmMessage', { name: currentSprint?.name })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
      />

      {/* Close Sprint Modal (enriched) */}
      <CloseSprintModal
        open={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        onSubmit={handleCloseSprint}
        sprint={currentSprint}
        loading={submitting}
      />

      {/* Import Modal */}
      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title={t('sprints.importReportTitle')}
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setShowImportModal(false)}>
              {t('common.cancel')}
            </Button>
            {(importFile || importPreview) && (
              <Button
                variant="primary"
                onClick={handleConfirmImport}
                disabled={importing || loadingPreview || (importPreview && !importPreview.metadata?.importedCount)}
                loading={importing}
              >
                {t('epics.importConfirm')}
              </Button>
            )}
          </div>
        }
      >
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ color: 'var(--ds-color-text-secondary)' }}>
            {t('sprints.importReportSubtitle', { name: importSprint?.name })}
          </p>
          <Badge variant="primary" size="lg">
            {importSprint?.name}
          </Badge>
        </div>

        {loadingPreview ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <Spinner size="lg" />
            <p style={{ marginTop: '1rem' }}>{t('common.loading')}</p>
          </div>
        ) : !importPreview ? (
          <div className="sprint-import">
            <FileUpload
              accept=".xlsx,.xls,.csv"
              onFileSelect={handleImportFileSelect}
              title={t('epics.importFileTitle')}
              description={t('epics.importFileDescription')}
              loading={loadingPreview}
              maxSize={10 * 1024 * 1024}
            />
            <div className="sprint-import__options">
              <Input
                label={t('epics.importSheetName')}
                value={importOptions.sheetName}
                onChange={(e) => setImportOptions({ ...importOptions, sheetName: e.target.value })}
                placeholder={t('epics.importSheetNamePlaceholder')}
              />
              <Input
                label={t('epics.importHeaderRow')}
                type="number"
                min={1}
                value={importOptions.headerRow}
                onChange={(e) => setImportOptions({ ...importOptions, headerRow: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>
        ) : (
          <div className="sprint-preview">
            <div className="sprint-preview__sprint">
              <strong>{t('epics.importTargetSprint')}:</strong> {importSprint?.name}
            </div>
            <div className="sprint-preview__info">
              <p>
                <strong>{t('epics.previewInfo', {
                  total: importPreview.metadata?.totalRows || 0,
                  valid: importPreview.metadata?.importedCount || 0
                })}</strong>
              </p>
              <p>
                <strong>{t('sprints.totalStoryPoints')}:</strong>{' '}
                {importPreview.metadata?.totalStoryPoints || 0} SP
              </p>
              {importPreview.metadata?.headers && (
                <p className="sprint-preview__columns">
                  <strong>{t('epics.detectedColumns')}:</strong> {importPreview.metadata.headers.join(', ')}
                </p>
              )}
            </div>

            {importPreview.preview && importPreview.preview.length > 0 && (
              <table className="sprint-preview__table">
                <thead>
                  <tr>
                    <th>{t('epics.key')}</th>
                    <th>{t('epics.issueType')}</th>
                    <th>{t('epics.titleField')}</th>
                    <th>{t('epics.storyPoints')}</th>
                    <th>{t('epics.parent')}</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.preview.slice(0, 5).map((item, index) => (
                    <tr key={index}>
                      <td>{item.key}</td>
                      <td>
                        {item.issueType ? (
                          <Badge variant={item.issueType?.toLowerCase() === 'epic' ? 'primary' : 'default'} size="sm" rounded>
                            {item.issueType}
                          </Badge>
                        ) : '-'}
                      </td>
                      <td>{item.title?.substring(0, 50)}{item.title?.length > 50 ? '...' : ''}</td>
                      <td>{item.storyPoints || '-'}</td>
                      <td>{item.parentSummary || item.parentKey || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {importPreview.errors && importPreview.errors.length > 0 && (
              <div className="sprint-preview__errors">
                <h4>{t('epics.previewErrors')}</h4>
                <ul>
                  {importPreview.errors.slice(0, 5).map((err, index) => (
                    <li key={index}>
                      {err.row ? `Ligne ${err.row}: ` : ''}{err.error || err}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Sprints;
