import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Input,
  Textarea,
  Spinner,
  Badge,
  Card,
  FileUpload,
  useToast,
} from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import { Tabs } from '../ui';
import CapacityPreviewCard from './CapacityPreviewCard';
import SprintJiraLinker from './SprintJiraLinker';
import { getDeliveredStoryPoints, getLiveDeliveredFromJira, calculateCapacity } from '../../services/sprintService';
import { previewImport, importEpics } from '../../services/epicService';
import './CloseSprintModal.css';

/**
 * Modal for closing a sprint with enriched data collection
 * 4 tabs: Team Review, Constraints Review, Deliveries, Summary & Velocity
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether modal is open
 * @param {Function} props.onClose - Close callback
 * @param {Function} props.onSubmit - Submit callback with close data
 * @param {Object} props.sprint - Sprint being closed (with populated team)
 * @param {boolean} props.loading - Whether submitting
 */
const CloseSprintModal = ({
  open,
  onClose,
  onSubmit,
  sprint,
  loading = false,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('team');

  // Actual team data (editable copy of planned team)
  const [actualTeam, setActualTeam] = useState([]);
  // Actual constraints (editable copy of planned constraints)
  const [actualConstraints, setActualConstraints] = useState({
    meetingsPercent: 10,
    bugsPercent: 10,
    tnrPercent: 5,
  });
  // Delivered story points
  const [deliveredSP, setDeliveredSP] = useState(0);
  const [useManualSP, setUseManualSP] = useState(false);
  const [manualSP, setManualSP] = useState(0);
  // Done epics from API
  const [doneEpics, setDoneEpics] = useState([]);
  const [calculatedSP, setCalculatedSP] = useState(0);
  const [loadingEpics, setLoadingEpics] = useState(false);
  // Décompte livré (items done, user stories, total rattaché, origine)
  const [deliveredMeta, setDeliveredMeta] = useState({ done: 0, stories: 0, linked: 0, source: null });
  // Notes
  const [notes, setNotes] = useState('');
  // Jira import
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  // Actual capacity preview
  const [actualCapacity, setActualCapacity] = useState(null);
  const [plannedCapacity, setPlannedCapacity] = useState(null);

  // Reset when modal opens
  useEffect(() => {
    if (open && sprint) {
      // Pre-fill actual team from planned team
      const teamData = sprint.team?.map(entry => ({
        member: entry.member?._id || entry.member,
        memberInfo: entry.member, // Keep populated info for display
        availability: entry.availability ?? 100,
        daysOff: entry.daysOff ?? 0,
      })) || [];
      setActualTeam(teamData);

      // Pre-fill actual constraints from planned constraints
      setActualConstraints({
        meetingsPercent: sprint.constraints?.meetingsPercent ?? 10,
        bugsPercent: sprint.constraints?.bugsPercent ?? 10,
        tnrPercent: sprint.constraints?.tnrPercent ?? 5,
      });

      setNotes('');
      setUseManualSP(false);
      setImportFile(null);
      setImportPreview(null);
      setImportResult(null);
      setActiveTab('team');

      // Livré : interrogation Jira live si lié (le plus à jour pour la clôture),
      // sinon lecture des tickets synchronisés en base.
      if (sprint.jiraId != null) {
        syncLiveDelivered(true);
      } else {
        fetchDeliveredSP();
      }
      // Calculate planned capacity for comparison
      fetchPlannedCapacity();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sprint]);

  // Recalculate actual capacity when team or constraints change
  useEffect(() => {
    if (open && sprint && actualTeam.length > 0) {
      fetchActualCapacity();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualTeam, actualConstraints, open, sprint]);

  // Update delivered SP based on mode
  useEffect(() => {
    setDeliveredSP(useManualSP ? manualSP : calculatedSP);
  }, [useManualSP, manualSP, calculatedSP]);

  const fetchDeliveredSP = async () => {
    if (!sprint?._id) return 0;
    setLoadingEpics(true);
    try {
      const result = await getDeliveredStoryPoints(sprint._id);
      const total = result.data?.totalStoryPoints || 0;
      setDoneEpics(result.data?.epics || []);
      setCalculatedSP(total);
      setManualSP(total);
      setDeliveredMeta({
        done: result.data?.epicCount || 0,
        stories: result.data?.deliveredStories || 0,
        linked: result.data?.linkedTotal || 0,
        source: result.data?.source || null,
      });
      return total;
    } catch (error) {
      console.error('Error fetching delivered SP:', error);
      setDoneEpics([]);
      setCalculatedSP(0);
      setDeliveredMeta({ done: 0, stories: 0, linked: 0, source: null });
      return 0;
    } finally {
      setLoadingEpics(false);
    }
  };

  // Action explicite : récupère les SP des items « done » du sprint et applique la valeur.
  // Distingue clairement une erreur (requête échouée) d'un vrai zéro, et donne du contexte.
  const handleFetchDeliveredSP = async () => {
    if (!sprint?._id) return;
    setUseManualSP(false);
    setLoadingEpics(true);
    try {
      const result = await getDeliveredStoryPoints(sprint._id);
      const total = result.data?.totalStoryPoints || 0;
      const doneCount = result.data?.epicCount || 0;
      const linkedTotal = result.data?.linkedTotal || 0;
      setDoneEpics(result.data?.epics || []);
      setCalculatedSP(total);
      setManualSP(total);
      setDeliveredMeta({
        done: doneCount,
        stories: result.data?.deliveredStories || 0,
        linked: linkedTotal,
        source: result.data?.source || null,
      });

      if (linkedTotal === 0) {
        // Aucun ticket rattaché à ce sprint interne → réconciliation nécessaire
        showToast({ type: 'warning', message: t('sprints.closeSprint.spNoLinked') });
      } else if (total === 0) {
        showToast({ type: 'warning', message: t('sprints.closeSprint.spNoneDone', { total: linkedTotal }) });
      } else {
        showToast({ type: 'success', message: t('sprints.closeSprint.spFetchedCtx', { sp: total, done: doneCount, total: linkedTotal }) });
      }
    } catch (error) {
      const httpStatus = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let message;
      if (httpStatus === 401 || httpStatus === 403) {
        message = t('sprints.closeSprint.spSessionExpired');
      } else if (!error?.response) {
        message = t('sprints.closeSprint.spNetworkError');
      } else {
        message = t('sprints.closeSprint.spFetchError', { error: serverMsg || `HTTP ${httpStatus}` });
      }
      showToast({ type: 'error', message });
    } finally {
      setLoadingEpics(false);
    }
  };

  // Interroge Jira EN DIRECT (API Agile) pour le livré du sprint — le plus utile
  // au moment de la clôture. Appelée automatiquement à l'ouverture si le sprint
  // est lié à Jira, et via le bouton « Synchroniser depuis Jira ».
  const syncLiveDelivered = async (silent = false) => {
    if (!sprint?._id || sprint.jiraId == null) return;
    setUseManualSP(false);
    setLoadingEpics(true);
    try {
      const result = await getLiveDeliveredFromJira(sprint._id);
      const total = result.data?.totalStoryPoints || 0;
      const stories = result.data?.deliveredStories || 0;
      setCalculatedSP(total);
      setManualSP(total);
      setDeliveredMeta({
        done: result.data?.epicCount || 0,
        stories,
        linked: result.data?.linked || 0,
        source: 'jira-live',
      });
      if (!silent) {
        showToast({ type: 'success', message: t('sprints.closeSprint.spSyncedLive', { sp: total, us: stories, defaultValue: `Jira : ${total} SP · ${stories} US livrées` }) });
      }
    } catch (error) {
      if (!silent) {
        showToast({ type: 'error', message: error.message || t('sprints.closeSprint.spFetchError', { error: 'Jira' }) });
      }
    } finally {
      setLoadingEpics(false);
    }
  };

  const fetchPlannedCapacity = async () => {
    if (!sprint) return;
    try {
      const result = await calculateCapacity({
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        team: sprint.team?.map(t => ({
          member: t.member?._id || t.member,
          availability: t.availability ?? 100,
          daysOff: t.daysOff ?? 0,
        })),
        constraints: sprint.constraints,
      });
      setPlannedCapacity(result.data);
    } catch (error) {
      console.error('Error calculating planned capacity:', error);
    }
  };

  const fetchActualCapacity = async () => {
    if (!sprint) return;
    try {
      const result = await calculateCapacity({
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        team: actualTeam.map(t => ({
          member: t.member,
          availability: t.availability,
          daysOff: t.daysOff,
        })),
        constraints: actualConstraints,
      });
      setActualCapacity(result.data);
    } catch (error) {
      console.error('Error calculating actual capacity:', error);
    }
  };

  // Handle Jira file upload → preview
  const handleFileSelect = useCallback(async (file) => {
    setImportFile(file);
    setImportPreview(null);
    setImportResult(null);
    setImportLoading(true);
    try {
      const preview = await previewImport(file);
      setImportPreview(preview.data || preview);
    } catch (error) {
      showToast({ type: 'error', message: error.message || t('sprints.closeSprint.importError') });
      setImportFile(null);
    } finally {
      setImportLoading(false);
    }
  }, [showToast, t]);

  // Confirm import
  const handleConfirmImport = useCallback(async () => {
    if (!importFile || !sprint?._id) return;
    setImportLoading(true);
    try {
      const result = await importEpics(importFile, {
        sprint: sprint._id,
        skipDuplicates: true,
      });
      setImportResult(result);
      showToast({ type: 'success', message: t('sprints.closeSprint.importSuccess', { count: result.inserted || result.count || 0 }) });
      // Refresh done epics after import
      fetchDeliveredSP();
    } catch (error) {
      showToast({ type: 'error', message: error.message || t('sprints.closeSprint.importError') });
    } finally {
      setImportLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importFile, sprint, showToast, t]);

  // Handle actual team member changes
  const handleTeamChange = useCallback((index, field, value) => {
    setActualTeam(prev => prev.map((entry, i) =>
      i === index ? { ...entry, [field]: parseInt(value) || 0 } : entry
    ));
  }, []);

  // Handle actual constraint changes
  const handleConstraintChange = useCallback((field, value) => {
    setActualConstraints(prev => ({
      ...prev,
      [field]: parseInt(value) || 0,
    }));
  }, []);

  // Handle submit
  const handleSubmit = useCallback(() => {
    onSubmit({
      actualTeam: actualTeam.map(t => ({
        member: t.member,
        availability: t.availability,
        daysOff: t.daysOff,
      })),
      actualConstraints,
      deliveredStoryPoints: deliveredSP,
      notes: notes.trim() || undefined,
    });
  }, [actualTeam, actualConstraints, deliveredSP, notes, onSubmit]);

  // Velocity calculation
  const velocityValue = actualCapacity?.netCapacity > 0
    ? Math.round((deliveredSP / actualCapacity.netCapacity) * 100) / 100
    : 0;

  // Tab navigation
  const tabs = [
    { id: 'team', label: t('sprints.closeSprint.teamReview') },
    { id: 'constraints', label: t('sprints.closeSprint.constraintsReview') },
    { id: 'deliveries', label: t('sprints.closeSprint.deliveries') },
    { id: 'summary', label: t('sprints.closeSprint.summaryVelocity') },
  ];

  const currentTabIndex = tabs.findIndex(tab => tab.id === activeTab);
  const isFirstTab = currentTabIndex === 0;
  const isLastTab = currentTabIndex === tabs.length - 1;

  const handlePrevious = () => {
    if (!isFirstTab) setActiveTab(tabs[currentTabIndex - 1].id);
  };

  const handleNext = () => {
    if (!isLastTab) setActiveTab(tabs[currentTabIndex + 1].id);
  };

  // Delta indicator
  const DeltaIndicator = ({ planned, actual }) => {
    const delta = actual - planned;
    if (Math.abs(delta) < 0.1) return null;
    const isFavorable = delta > 0;
    return (
      <span className={`close-sprint__delta close-sprint__delta--${isFavorable ? 'favorable' : 'unfavorable'}`}>
        {delta > 0 ? '+' : ''}{delta.toFixed(1)}
      </span>
    );
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'team':
        return (
          <div className="close-sprint__tab-content">
            <table className="close-sprint__table">
              <thead>
                <tr>
                  <th>{t('sprints.closeSprint.memberName')}</th>
                  <th>{t('sprints.closeSprint.plannedAvailability')}</th>
                  <th>{t('sprints.closeSprint.actualAvailability')}</th>
                  <th>{t('sprints.closeSprint.plannedDaysOff')}</th>
                  <th>{t('sprints.closeSprint.actualDaysOff')}</th>
                </tr>
              </thead>
              <tbody>
                {actualTeam.map((entry, index) => {
                  const plannedEntry = sprint.team?.find(
                    t => (t.member?._id || t.member) === entry.member
                  );
                  const memberInfo = entry.memberInfo || {};
                  return (
                    <tr key={entry.member}>
                      <td>
                        <div className="close-sprint__member-info">
                          <span className="close-sprint__member-name">
                            {memberInfo.firstName} {memberInfo.lastName}
                          </span>
                          {memberInfo.role && (
                            <span className="close-sprint__member-role">{memberInfo.role}</span>
                          )}
                        </div>
                      </td>
                      <td className="close-sprint__planned-cell">
                        {plannedEntry?.availability ?? 100}%
                      </td>
                      <td>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={entry.availability}
                          onChange={(e) => handleTeamChange(index, 'availability', e.target.value)}
                          className="close-sprint__inline-input"
                        />
                      </td>
                      <td className="close-sprint__planned-cell">
                        {plannedEntry?.daysOff ?? 0}
                      </td>
                      <td>
                        <Input
                          type="number"
                          min={0}
                          value={entry.daysOff}
                          onChange={(e) => handleTeamChange(index, 'daysOff', e.target.value)}
                          className="close-sprint__inline-input"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );

      case 'constraints':
        return (
          <div className="close-sprint__tab-content">
            <table className="close-sprint__table close-sprint__table--constraints">
              <thead>
                <tr>
                  <th>{t('sprints.closeSprint.constraintType')}</th>
                  <th>{t('sprints.closeSprint.plannedPercent')}</th>
                  <th>{t('sprints.closeSprint.actualPercent')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('sprints.meetingsPercent')}</td>
                  <td className="close-sprint__planned-cell">
                    {sprint.constraints?.meetingsPercent ?? 10}%
                  </td>
                  <td>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={actualConstraints.meetingsPercent}
                      onChange={(e) => handleConstraintChange('meetingsPercent', e.target.value)}
                      className="close-sprint__inline-input"
                    />
                  </td>
                </tr>
                <tr>
                  <td>{t('sprints.bugsPercent')}</td>
                  <td className="close-sprint__planned-cell">
                    {sprint.constraints?.bugsPercent ?? 10}%
                  </td>
                  <td>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={actualConstraints.bugsPercent}
                      onChange={(e) => handleConstraintChange('bugsPercent', e.target.value)}
                      className="close-sprint__inline-input"
                    />
                  </td>
                </tr>
                <tr>
                  <td>{t('sprints.tnrPercent')}</td>
                  <td className="close-sprint__planned-cell">
                    {sprint.constraints?.tnrPercent ?? 5}%
                  </td>
                  <td>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={actualConstraints.tnrPercent}
                      onChange={(e) => handleConstraintChange('tnrPercent', e.target.value)}
                      className="close-sprint__inline-input"
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Mini capacity preview with actual values */}
            {actualCapacity && (
              <div className="close-sprint__capacity-mini">
                <CapacityPreviewCard capacity={actualCapacity} />
              </div>
            )}
          </div>
        );

      case 'deliveries':
        return (
          <div className="close-sprint__tab-content">
            {/* Lien vers le sprint Jira (pour rattacher les tickets et récupérer les SP) */}
            <SprintJiraLinker sprint={sprint} onLinked={() => (sprint.jiraId != null ? syncLiveDelivered(false) : fetchDeliveredSP())} />

            {/* Jira import section */}
            <div className="close-sprint__import-section">
              <h4 className="close-sprint__section-title">
                {t('sprints.closeSprint.importJira')}
              </h4>
              {importResult ? (
                <div className="close-sprint__import-done">
                  <Badge variant="success" size="sm" rounded>
                    <i className="bi bi-check-circle me-1"></i>
                    {t('sprints.closeSprint.importSuccess', { count: importResult.inserted || importResult.count || 0 })}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => { setImportFile(null); setImportPreview(null); setImportResult(null); }}
                  >
                    {t('sprints.closeSprint.importAnother')}
                  </Button>
                </div>
              ) : importPreview ? (
                <div className="close-sprint__import-preview">
                  <div className="close-sprint__import-meta">
                    <span>{t('sprints.closeSprint.previewItems', { count: importPreview.totalRows || importPreview.preview?.length || 0 })}</span>
                    <span>{t('sprints.closeSprint.previewSP', { sp: importPreview.totalStoryPoints || 0 })}</span>
                  </div>
                  <div className="close-sprint__import-actions">
                    <Button
                      variant="primary"
                      size="small"
                      onClick={handleConfirmImport}
                      loading={importLoading}
                    >
                      {t('sprints.closeSprint.confirmImport')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => { setImportFile(null); setImportPreview(null); }}
                      disabled={importLoading}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <FileUpload
                  title={t('sprints.closeSprint.importFileTitle')}
                  description={t('sprints.closeSprint.importFileDescription')}
                  accept=".xlsx,.xls,.csv"
                  fileTypeLabel="Excel/CSV"
                  onFileSelect={handleFileSelect}
                  loading={importLoading}
                  maxSize={10 * 1024 * 1024}
                />
              )}
            </div>

            {loadingEpics ? (
              <div className="close-sprint__loading">
                <Spinner size="md" />
              </div>
            ) : (
              <>
                {/* Done epics table */}
                <h4 className="close-sprint__section-title">
                  {t('sprints.closeSprint.doneEpics')} ({doneEpics.length})
                </h4>
                {doneEpics.length > 0 ? (
                  <div className="close-sprint__epics-table-wrapper">
                    <table className="close-sprint__table close-sprint__table--epics">
                      <thead>
                        <tr>
                          <th>{t('sprints.closeSprint.epicKey')}</th>
                          <th>{t('sprints.closeSprint.epicTitle')}</th>
                          <th>{t('sprints.closeSprint.epicSP')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doneEpics.map(epic => (
                          <tr key={epic._id}>
                            <td><Badge variant="default" size="sm" rounded>{epic.key}</Badge></td>
                            <td>{epic.title}</td>
                            <td className="close-sprint__sp-cell">{epic.storyPoints || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2}><strong>Total</strong></td>
                          <td className="close-sprint__sp-cell"><strong>{calculatedSP} SP</strong></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="close-sprint__empty-text">
                    {t('sprints.closeSprint.noEpicsDone')}
                  </p>
                )}

                {/* SP adjustment */}
                <div className="close-sprint__sp-adjustment">
                  <div className="close-sprint__sp-fetch">
                    {sprint.jiraId != null ? (
                      <Button variant="primary" size="small" onClick={() => syncLiveDelivered(false)} loading={loadingEpics}>
                        <i className="bi bi-arrow-repeat me-1"></i>
                        {t('sprints.closeSprint.syncJiraLive', 'Synchroniser depuis Jira')}
                      </Button>
                    ) : (
                      <Button variant="secondary" size="small" onClick={handleFetchDeliveredSP} loading={loadingEpics}>
                        <i className="bi bi-database me-1"></i>
                        {t('sprints.closeSprint.fetchDoneSP', 'Récupérer les SP terminés')}
                      </Button>
                    )}
                    <span className="close-sprint__sp-fetch-hint">
                      {sprint.jiraId != null
                        ? t('sprints.closeSprint.syncJiraLiveHint', 'Interroge Jira en direct pour le livré (SP + US) selon vos critères de statut.')
                        : t('sprints.closeSprint.fetchDoneSPHint', 'Somme des SP des items au statut « terminé » (même règle que les autres pages).')}
                    </span>
                  </div>
                  {deliveredMeta.linked > 0 && (
                    <div className="close-sprint__delivered-meta">
                      <span className="close-sprint__delivered-meta-main">
                        <strong>{deliveredMeta.done}</strong> {t('sprints.closeSprint.itemsDelivered', 'items livrés')}
                        {deliveredMeta.stories > 0 && (
                          <> · <strong>{deliveredMeta.stories}</strong> {t('sprints.closeSprint.userStories', 'user stories')}</>
                        )}
                        {' '}/ {deliveredMeta.linked} {t('sprints.closeSprint.itemsLinked', 'rattachés')}
                      </span>
                      {deliveredMeta.source === 'jira-live' ? (
                        <span className="close-sprint__delivered-meta-src">
                          <i className="bi bi-broadcast" /> {t('sprints.closeSprint.viaJiraLive', 'Jira en direct')}
                        </span>
                      ) : deliveredMeta.source === 'jira' && (
                        <span className="close-sprint__delivered-meta-src">
                          <i className="bi bi-link-45deg" /> {t('sprints.closeSprint.viaJira', 'via le sprint Jira lié')}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="close-sprint__sp-toggle">
                    <label className="close-sprint__toggle-label">
                      <input
                        type="checkbox"
                        checked={useManualSP}
                        onChange={(e) => setUseManualSP(e.target.checked)}
                      />
                      {t('sprints.closeSprint.manualAdjust')}
                    </label>
                  </div>
                  {useManualSP ? (
                    <Input
                      label={t('sprints.closeSprint.deliveredSP')}
                      type="number"
                      min={0}
                      value={manualSP}
                      onChange={(e) => setManualSP(parseInt(e.target.value) || 0)}
                      fullWidth
                    />
                  ) : (
                    <div className="close-sprint__auto-sp">
                      <span className="close-sprint__auto-sp-label">
                        {t('sprints.closeSprint.deliveredSP')}
                      </span>
                      <span className="close-sprint__auto-sp-value">{calculatedSP} SP</span>
                      <span className="close-sprint__auto-sp-note">
                        {t('sprints.closeSprint.autoCalculated')}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        );

      case 'summary':
        return (
          <div className="close-sprint__tab-content">
            {/* Planned vs Actual comparison */}
            <h4 className="close-sprint__section-title">
              {t('sprints.closeSprint.plannedVsActual')}
            </h4>
            <div className="close-sprint__comparison">
              <table className="close-sprint__table close-sprint__table--comparison">
                <thead>
                  <tr>
                    <th></th>
                    <th>{t('sprints.closeSprint.planned')}</th>
                    <th>{t('sprints.closeSprint.actual')}</th>
                    <th>{t('sprints.closeSprint.delta')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{t('sprints.closeSprint.grossCapacityComparison')}</td>
                    <td>{plannedCapacity?.grossCapacity?.toFixed(1) || 0} j</td>
                    <td>{actualCapacity?.grossCapacity?.toFixed(1) || 0} j</td>
                    <td>
                      {plannedCapacity && actualCapacity && (
                        <DeltaIndicator
                          planned={plannedCapacity.grossCapacity || 0}
                          actual={actualCapacity.grossCapacity || 0}
                        />
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>{t('sprints.closeSprint.constraintsComparison')}</td>
                    <td>-{plannedCapacity?.constraints?.total?.toFixed(1) || 0} j</td>
                    <td>-{actualCapacity?.constraints?.total?.toFixed(1) || 0} j</td>
                    <td>
                      {plannedCapacity && actualCapacity && (
                        <DeltaIndicator
                          planned={-(plannedCapacity.constraints?.total || 0)}
                          actual={-(actualCapacity.constraints?.total || 0)}
                        />
                      )}
                    </td>
                  </tr>
                  <tr className="close-sprint__comparison-highlight">
                    <td><strong>{t('sprints.closeSprint.netCapacityComparison')}</strong></td>
                    <td><strong>{plannedCapacity?.netCapacity?.toFixed(1) || 0} j</strong></td>
                    <td><strong>{actualCapacity?.netCapacity?.toFixed(1) || 0} j</strong></td>
                    <td>
                      {plannedCapacity && actualCapacity && (
                        <DeltaIndicator
                          planned={plannedCapacity.netCapacity || 0}
                          actual={actualCapacity.netCapacity || 0}
                        />
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Velocity result */}
            <Card variant="outlined" padding="md" className="close-sprint__velocity-card">
              <div className="close-sprint__velocity-grid">
                <div className="close-sprint__velocity-item">
                  <span className="close-sprint__velocity-label">
                    {t('sprints.closeSprint.deliveredSP')}
                  </span>
                  <span className="close-sprint__velocity-value">{deliveredSP} SP</span>
                </div>
                <div className="close-sprint__velocity-divider">/</div>
                <div className="close-sprint__velocity-item">
                  <span className="close-sprint__velocity-label">
                    {t('sprints.closeSprint.actualNetCapacity')}
                  </span>
                  <span className="close-sprint__velocity-value">
                    {actualCapacity?.netCapacity?.toFixed(1) || 0} j
                  </span>
                </div>
                <div className="close-sprint__velocity-divider">=</div>
                <div className="close-sprint__velocity-item close-sprint__velocity-item--result">
                  <span className="close-sprint__velocity-label">
                    {t('sprints.closeSprint.velocityResult')}
                  </span>
                  <span className="close-sprint__velocity-value close-sprint__velocity-value--highlight">
                    {velocityValue} {t('sprints.closeSprint.velocityUnit')}
                  </span>
                </div>
              </div>
            </Card>

            {/* Notes */}
            <Textarea
              label={t('sprints.closeSprint.notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('sprints.closeSprint.notesPlaceholder')}
              rows={3}
              fullWidth
            />
          </div>
        );

      default:
        return null;
    }
  };

  if (!sprint) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('sprints.closeMessage', { name: sprint.name })}
      size="lg"
      className="close-sprint-modal"
      footer={
        <div className="close-sprint__footer">
          <div className="close-sprint__footer-left">
            {!isFirstTab && (
              <Button variant="ghost" onClick={handlePrevious} disabled={loading}>
                {t('common.previous')}
              </Button>
            )}
          </div>
          <div className="close-sprint__footer-right">
            <Button variant="ghost" onClick={onClose} disabled={loading}>
              {t('common.cancel')}
            </Button>
            {isLastTab ? (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={loading}
                loading={loading}
              >
                {t('sprints.close')}
              </Button>
            ) : (
              <Button variant="primary" onClick={handleNext} disabled={loading}>
                {t('common.next')}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="close-sprint">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          variant="underline"
        />
        <div className="close-sprint__content">
          {renderTabContent()}
        </div>
      </div>
    </Modal>
  );
};

export default CloseSprintModal;
