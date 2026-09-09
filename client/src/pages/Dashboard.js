import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Badge, Spinner, ProgressBar, Button, useToast } from '@frhamon/design-system';
import {
  ResponsiveContainer, Tooltip,
  Bar, XAxis, YAxis, CartesianGrid, Legend, Line, ComposedChart
} from 'recharts';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getSprints,
  createSprint,
  updateSprint,
  activateSprint,
  closeSprint,
  calculateCapacity,
  getDeliveredStoryPoints,
  getLiveDeliveredFromJira
} from '../services/sprintService';
import { getTeamMembers } from '../services/teamMemberService';
import { getStats } from '../services/epicService';
import { SprintFormModal, CloseSprintModal } from '../components/sprint';
import Tabs from '../components/ui/Tabs';
import '../styles/Dashboard.css';

// Mini-courbe (sparkline) SVG pour la série de vélocité
const Sparkline = ({ values, width = 72, height = 24 }) => {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pt = (v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = height - 3 - ((v - min) / range) * (height - 6);
    return [x, y];
  };
  const points = values.map((v, i) => pt(v, i).map((n) => n.toFixed(1)).join(',')).join(' ');
  const [lx, ly] = pt(values[values.length - 1], values.length - 1);
  return (
    <svg className="dashboard-stats__spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.4" fill="currentColor" />
    </svg>
  );
};

const Dashboard = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeSprint, setActiveSprint] = useState(null);
  const [upcomingSprint, setUpcomingSprint] = useState(null);
  const [closedCount, setClosedCount] = useState(0);
  const [epicStats, setEpicStats] = useState(null);
  const [closedSprints, setClosedSprints] = useState([]);
  // Livré du sprint actif (SP + US) selon le mapping de statuts, depuis les tickets Jira synchronisés
  const [liveDelivered, setLiveDelivered] = useState(null);
  const [refreshingDelivered, setRefreshingDelivered] = useState(false);

  // Sprint management
  const [sprints, setSprints] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [currentSprint, setCurrentSprint] = useState(null);
  const [capacityPreview, setCapacityPreview] = useState(null);

  // Bottom tabs
  const [dashboardTab, setDashboardTab] = useState('sprints');


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sprintsRes, teamRes] = await Promise.all([
        getSprints(),
        getTeamMembers().catch(() => ({ data: [] })),
      ]);

      const allSprints = sprintsRes.data || [];
      const active = allSprints.find((s) => s.status === 'active');
      const draft = allSprints
        .filter((s) => s.status === 'draft' && s.startDate)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0];
      const closed = allSprints.filter((s) => s.status === 'closed');

      setSprints(allSprints.slice().sort((a, b) => new Date(b.startDate) - new Date(a.startDate)));
      setTeamMembers(teamRes.data || []);
      setActiveSprint(active || null);
      setUpcomingSprint(draft || null);
      setClosedCount(closed.length);

      const sortedClosed = [...closed].sort(
        (a, b) => new Date(a.startDate) - new Date(b.startDate)
      );
      setClosedSprints(sortedClosed);

      if (active) {
        try {
          const statsRes = await getStats({ sprint: active._id });
          setEpicStats(statsRes.data || null);
        } catch {
          setEpicStats(null);
        }
        // Livré (SP + US) selon le mapping, depuis les tickets du sprint Jira lié
        try {
          const d = await getDeliveredStoryPoints(active._id);
          setLiveDelivered({
            sp: d.data?.totalStoryPoints || 0,
            stories: d.data?.deliveredStories || 0,
            done: d.data?.epicCount || 0,
            linked: d.data?.linkedTotal || 0,
          });
        } catch {
          setLiveDelivered(null);
        }
      } else {
        setLiveDelivered(null);
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Synchronisation à la volée : interroge Jira EN DIRECT (API Agile) pour le
  // sprint actif, puis met à jour le livré affiché.
  const syncDeliveredFromJira = useCallback(async () => {
    if (!activeSprint?._id) return;
    setRefreshingDelivered(true);
    try {
      const d = await getLiveDeliveredFromJira(activeSprint._id);
      setLiveDelivered({
        sp: d.data?.totalStoryPoints || 0,
        stories: d.data?.deliveredStories || 0,
        done: d.data?.epicCount || 0,
        linked: d.data?.linked || 0,
        source: 'jira-live',
      });
      showToast({ type: 'success', message: t('dashboard.deliveredSynced', 'Livré synchronisé depuis Jira') });
    } catch (e) {
      showToast({ type: 'error', message: e.message || t('dashboard.deliveredSyncError', 'Synchronisation Jira impossible') });
    } finally {
      setRefreshingDelivered(false);
    }
  }, [activeSprint, showToast, t]);

  // Velocity stats computed from closed sprints (for Quick Stats card)
  const velocityStats = useMemo(() => {
    if (closedSprints.length === 0) return null;

    const chrono = [...closedSprints].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    // Sprints with actual velocity data (set when closing with delivered SP)
    const withV = chrono.filter(s => (s.velocity?.actual ?? 0) > 0);

    // Vélocité : moyenne + série des 3 derniers sprints
    const window3 = withV.slice(-3);
    const avg = window3.length > 0
      ? window3.reduce((sum, s) => sum + s.velocity.actual, 0) / window3.length
      : null;
    const count = window3.length;
    const totalWithVelocity = withV.length;
    const velSeries = window3.map(s => s.velocity.actual);

    // Panier recommandé par sprint = capacité planifiée × vélocité glissante des
    // sprints PRÉCÉDENTS (ce qui aurait été recommandé au planning).
    const velHistory = [];
    const baskets = [];
    chrono.forEach((s) => {
      const w = velHistory.slice(-3);
      const prevAvg = w.length ? w.reduce((x, v) => x + v, 0) / w.length : null;
      const cap = s.capacity?.planned || 0;
      if (prevAvg && cap > 0) baskets.push(Math.round(cap * prevAvg));
      const v = s.velocity?.actual ?? 0;
      if (v > 0) velHistory.push(v);
    });
    const basketWindow = baskets.slice(-3);
    const avgBasket = basketWindow.length
      ? Math.round(basketWindow.reduce((a, b) => a + b, 0) / basketWindow.length)
      : null;
    const basketCount = basketWindow.length;

    // Tendance adaptative : moitié récente vs moitié précédente (fenêtre 1→3),
    // calculable dès 2 points. Réutilisée pour la vélocité et le panier.
    const computeTrend = (arr) => {
      if (arr.length < 2) return { deltaPercent: null, dir: null };
      const w = Math.min(3, Math.floor(arr.length / 2));
      const recent = arr.slice(-w);
      const prior = arr.slice(-2 * w, -w);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const priorAvg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : recentAvg;
      const d = priorAvg > 0 ? Math.round((recentAvg - priorAvg) / priorAvg * 100) : 0;
      return { deltaPercent: d, dir: d > 2 ? 'increasing' : d < -2 ? 'decreasing' : 'stable' };
    };

    const velTrend = computeTrend(withV.map(s => s.velocity.actual));
    const basketTrend = computeTrend(baskets);

    // Alert: 3 consecutive declining velocities
    const hasDeclineAlert = withV.length >= 3 &&
      withV[withV.length - 1].velocity.actual < withV[withV.length - 2].velocity.actual &&
      withV[withV.length - 2].velocity.actual < withV[withV.length - 3].velocity.actual;

    return {
      avg, count, totalWithVelocity, velSeries,
      deltaPercent: velTrend.deltaPercent, trendDir: velTrend.dir, hasDeclineAlert,
      avgBasket, basketCount,
      basketDeltaPercent: basketTrend.deltaPercent, basketTrendDir: basketTrend.dir,
    };
  }, [closedSprints]);

  // Sprint management handlers
  const handleFormChange = useCallback(async (formData) => {
    if (formData.startDate && formData.endDate && formData.team?.length > 0) {
      try {
        const result = await calculateCapacity({
          startDate: formData.startDate,
          endDate: formData.endDate,
          team: formData.team,
          constraints: formData.constraints
        });
        setCapacityPreview(result.data);
      } catch {
        setCapacityPreview(null);
      }
    } else {
      setCapacityPreview(null);
    }
  }, []);

  const handleCreate = () => {
    setCurrentSprint(null);
    setCapacityPreview(null);
    setShowFormModal(true);
  };

  const handleEdit = (sprint) => {
    setCurrentSprint(sprint);
    setShowFormModal(true);
  };

  const handleSubmit = async (formData) => {
    setSubmitting(true);
    try {
      if (currentSprint) {
        await updateSprint(currentSprint._id, formData);
        showToast({ type: 'success', message: t('sprints.updateSuccess') });
      } else {
        await createSprint(formData);
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


  const handleActivate = async (sprint) => {
    try {
      await activateSprint(sprint._id);
      showToast({ type: 'success', message: t('sprints.activateSuccess') });
      fetchData();
    } catch (error) {
      showToast({ type: 'error', message: error.message });
    }
  };

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

  // Sprint progress helpers
  const getSprintProgress = (sprint) => {
    if (!sprint?.startDate || !sprint?.endDate)
      return { elapsed: 0, total: 0, percent: 0, remaining: 0 };

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(sprint.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(sprint.endDate);
    end.setHours(0, 0, 0, 0);

    const countWorkingDays = (from, to) => {
      let count = 0;
      const d = new Date(from);
      while (d <= to) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) count++;
        d.setDate(d.getDate() + 1);
      }
      return count;
    };

    const total = countWorkingDays(start, end);
    const effectiveNow = now > end ? end : now < start ? start : now;
    const elapsed = countWorkingDays(start, effectiveNow);
    const remaining = total - elapsed;
    const percent = total > 0 ? Math.round((elapsed / total) * 100) : 0;

    return { elapsed, total, remaining, percent };
  };

  const getDaysUntil = (dateStr) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  // Prepare velocity chart data from closed sprints
  const getVelocityChartData = () => {
    // Panier recommandé par sprint = capacité nette × moyenne glissante des
    // vélocités des sprints PRÉCÉDENTS (ce qui aurait été recommandé au planning).
    const chrono = [...closedSprints].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const velHistory = [];
    const basketById = new Map();
    chrono.forEach((s) => {
      const window = velHistory.slice(-3);
      const prevAvg = window.length ? window.reduce((x, v) => x + v, 0) / window.length : null;
      const cap = s.capacity?.planned || 0;
      basketById.set(String(s._id), (prevAvg && cap > 0) ? Math.round(cap * prevAvg) : null);
      const v = s.velocity?.actual ?? 0;
      if (v > 0) velHistory.push(v);
    });

    return closedSprints.map((s) => ({
      name: s.name.length > 12 ? s.name.substring(0, 12) + '…' : s.name,
      fullName: s.name,
      velocity: s.velocity?.actual || 0,
      spDelivered: s.deliveredStoryPoints || 0,
      basket: basketById.get(String(s._id)),
      capacityPlanned: s.capacity?.planned ? Math.round(s.capacity.planned * 10) / 10 : 0,
      capacityActual: s.capacity?.actual ? Math.round(s.capacity.actual * 10) / 10 : 0,
    }));
  };

  // Custom tooltip for velocity chart
  const VelocityTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;
    return (
      <div className="dashboard-tooltip">
        <div className="dashboard-tooltip__title">{data.fullName}</div>
        <div>{t('dashboard.spPerDay')}: <strong>{data.velocity}</strong></div>
        <div>{t('dashboard.spDelivered')}: <strong>{data.spDelivered} SP</strong></div>
        <div>{t('dashboard.plannedCapacity')}: <strong>{data.capacityPlanned}j</strong></div>
        <div>{t('dashboard.actualCapacity')}: <strong>{data.capacityActual}j</strong></div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-page__loading">
          <Spinner size="lg" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const progress = activeSprint ? getSprintProgress(activeSprint) : null;
  const velocityChartData = getVelocityChartData();

  // Calculate totals from epic stats
  const totalSP = epicStats?.totals?.totalStoryPoints || 0;
  const deliveredSP = epicStats?.byStatus
    ?.filter((s) => s.status === 'done')
    .reduce((sum, s) => sum + s.totalStoryPoints, 0) || 0;
  const deliveryPercent = totalSP > 0 ? Math.round((deliveredSP / totalSP) * 100) : 0;

  // Panier : nb de SP embarquables = capacité nette (jours) × vélocité moyenne (SP/j)
  const basketSP = (activeSprint?.capacity?.planned > 0 && velocityStats?.avg)
    ? Math.round(activeSprint.capacity.planned * velocityStats.avg)
    : null;

  return (
    <div className="dashboard-page">
      <div className="dashboard-page__header">
        <div>
          <h1>{t('dashboard.title')}</h1>
          <p className="dashboard-page__welcome">
            {t('dashboard.welcome', { name: currentUser?.firstName || '' })}
          </p>
        </div>
        <Button variant="primary" onClick={handleCreate}>
          <i className="bi bi-plus-lg me-2"></i>
          {t('sprints.create')}
        </Button>
      </div>

      <div className="dashboard-page__grid">
        {/* ===== Active Sprint Card ===== */}
        <Card variant="elevated" padding="lg" className="dashboard-sprint">
          <div className="dashboard-sprint__header">
            <h2 className="dashboard-sprint__section-title">
              <i className="bi bi-lightning-fill"></i>
              {t('dashboard.currentSprint')}
            </h2>
            {activeSprint && (
              <div className="dashboard-sprint__header-actions">
                {activeSprint.jiraId != null && (
                  <Badge variant="info" rounded size="sm" title={t('sprints.jiraLinkedBadge')}>
                    <i className="bi bi-link-45deg" /> Jira
                  </Badge>
                )}
                <Badge variant="success" dot rounded size="sm">
                  {t('sprints.status.active')}
                </Badge>
                <button
                  className="dashboard-sprint__action-btn"
                  title={t('common.edit')}
                  onClick={() => handleEdit(activeSprint)}
                >
                  <i className="bi bi-pencil" />
                </button>
                <button
                  className="dashboard-sprint__action-btn dashboard-sprint__action-btn--close"
                  title={t('sprints.close')}
                  onClick={() => { setCurrentSprint(activeSprint); setShowCloseModal(true); }}
                >
                  <i className="bi bi-check2-circle" />
                </button>
              </div>
            )}
          </div>

          {activeSprint ? (
            <div className="dashboard-sprint__content">
              <div className="dashboard-sprint__name">{activeSprint.name}</div>
              {activeSprint.goal && (
                <p className="dashboard-sprint__goal">{activeSprint.goal}</p>
              )}

              <div className="dashboard-sprint__dates">
                <span>{formatDate(activeSprint.startDate)}</span>
                <span className="dashboard-sprint__dates-sep">—</span>
                <span>{formatDate(activeSprint.endDate)}</span>
              </div>

              {/* Dual progress section */}
              <div className="dashboard-sprint__dual-progress">

                {/* Time bar — thin, neutral */}
                <div className="dashboard-sprint__progress-row">
                  <div className="dashboard-sprint__progress-meta">
                    <span className="dashboard-sprint__progress-track-label">
                      <i className="bi bi-clock" />
                      {t('dashboard.daysElapsed', { current: progress.elapsed, total: progress.total })}
                    </span>
                    <span className="dashboard-sprint__progress-track-value">
                      {t('dashboard.daysRemaining', { count: progress.remaining })}
                    </span>
                  </div>
                  <div
                    className="dashboard-sprint__time-bar-track"
                    title={`${progress.percent}% du temps écoulé`}
                  >
                    <div
                      className="dashboard-sprint__time-bar-fill"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>

                {/* SP bar — large, colored */}
                {totalSP > 0 && (
                  <div className="dashboard-sprint__progress-row">
                    <div className="dashboard-sprint__progress-meta">
                      <span className="dashboard-sprint__progress-track-label">
                        <i className="bi bi-lightning-fill" />
                        Story Points
                      </span>
                      <span className="dashboard-sprint__progress-track-value">
                        {deliveredSP} / {totalSP} SP
                      </span>
                    </div>
                    <ProgressBar
                      value={deliveredSP}
                      max={totalSP}
                      size="large"
                      showPercentage
                      animated
                      variant={deliveryPercent >= progress.percent ? 'success' : deliveryPercent >= progress.percent - 15 ? 'warning' : 'error'}
                    />
                  </div>
                )}

                {/* Synthesis label */}
                {totalSP > 0 && (() => {
                  const ahead = deliveryPercent - progress.percent;
                  let label, cls;
                  if (ahead >= 5) {
                    label = t('dashboard.spAhead', 'En avance');
                    cls = 'success';
                  } else if (ahead >= -15) {
                    label = t('dashboard.spOnTrack', 'On track');
                    cls = 'neutral';
                  } else {
                    const latePoints = Math.round((-ahead / 100) * totalSP);
                    label = t('dashboard.spLate', { count: latePoints, defaultValue: `Retard de ${latePoints} SP` });
                    cls = 'error';
                  }
                  return (
                    <div className={`dashboard-sprint__progress-status dashboard-sprint__progress-status--${cls}`}>
                      {cls === 'success' && <i className="bi bi-check-circle-fill" />}
                      {cls === 'neutral' && <i className="bi bi-dash-circle-fill" />}
                      {cls === 'error' && <i className="bi bi-exclamation-circle-fill" />}
                      {label}
                    </div>
                  );
                })()}

              </div>

              {/* Team avatars */}
              {activeSprint.team?.length > 0 && (
                <div className="dashboard-sprint__team">
                  {activeSprint.team.map((tm, idx) => {
                    const member = tm.member;
                    if (!member) return null;
                    const initials = `${(member.firstName || '')[0] || ''}${(member.lastName || '')[0] || ''}`.toUpperCase();
                    return (
                      <div
                        key={member._id || idx}
                        className="dashboard-sprint__avatar"
                        title={`${member.firstName} ${member.lastName}`}
                      >
                        {member.photo ? (
                          <img
                            src={member.photo}
                            alt={`${member.firstName} ${member.lastName}`}
                            className="dashboard-sprint__avatar-img"
                          />
                        ) : (
                          <span className="dashboard-sprint__avatar-initials">{initials}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sprint stats row */}
              <div className="dashboard-sprint__stats">
                <div className="dashboard-sprint__stat">
                  <span className="dashboard-sprint__stat-value">
                    {activeSprint.team?.length || 0}
                  </span>
                  <span className="dashboard-sprint__stat-label">
                    {t('dashboard.teamMembers')}
                  </span>
                </div>
                <div className="dashboard-sprint__stat">
                  <span className="dashboard-sprint__stat-value">
                    {activeSprint.capacity?.planned?.toFixed(1) || 0}j
                  </span>
                  <span className="dashboard-sprint__stat-label">
                    {t('dashboard.netCapacity')}
                  </span>
                </div>
                <div className="dashboard-sprint__stat">
                  <span className="dashboard-sprint__stat-value">
                    {activeSprint.workingDays || 0}
                  </span>
                  <span className="dashboard-sprint__stat-label">
                    {t('sprints.workingDays')}
                  </span>
                </div>
                {basketSP != null && (
                  <div className="dashboard-sprint__stat">
                    <span className="dashboard-sprint__stat-value dashboard-sprint__stat-value--basket">
                      {basketSP} SP
                    </span>
                    <span className="dashboard-sprint__stat-label">
                      {t('sprints.recommendedBasket')}
                    </span>
                  </div>
                )}
                {totalSP > 0 && (
                  <div className="dashboard-sprint__stat">
                    <span className="dashboard-sprint__stat-value dashboard-sprint__stat-value--success">
                      {deliveredSP}/{totalSP}
                    </span>
                    <span className="dashboard-sprint__stat-label">
                      {t('dashboard.deliveredSP')} ({deliveryPercent}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Livré en temps réel selon le mapping (sprint Jira lié) — affiché
                  dès que le sprint est lié à Jira, même sans données encore chargées. */}
              {activeSprint.jiraId != null && (() => {
                const d = liveDelivered || { sp: 0, stories: 0, done: 0, linked: 0 };
                const ref = basketSP || totalSP || 0;
                const pct = ref > 0 ? Math.min(100, Math.round((d.sp / ref) * 100)) : 0;
                return (
                  <div className="dashboard-sprint__delivered">
                    <div className="dashboard-sprint__delivered-head">
                      <span className="dashboard-sprint__delivered-title">
                        <i className="bi bi-graph-up-arrow" /> {t('dashboard.deliveredLive', 'Livré à date (Jira)')}
                        {d.source === 'jira-live' && (
                          <span className="dashboard-sprint__delivered-live-tag">live</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="dashboard-sprint__delivered-sync"
                        onClick={syncDeliveredFromJira}
                        disabled={refreshingDelivered}
                        title={t('dashboard.deliveredSync', 'Interroger Jira en direct pour actualiser le livré')}
                      >
                        <i className={`bi bi-arrow-repeat ${refreshingDelivered ? 'dashboard-spin' : ''}`} />
                        {refreshingDelivered ? t('common.loading', 'Chargement…') : t('dashboard.sync', 'Synchroniser')}
                      </button>
                    </div>
                    <div className="dashboard-sprint__delivered-metrics">
                      <span><strong>{d.sp}</strong> SP</span>
                      <span className="dashboard-sprint__delivered-sep">·</span>
                      <span><strong>{d.stories}</strong> {t('dashboard.userStoriesShort', 'US')}</span>
                      {ref > 0 && (
                        <span className="dashboard-sprint__delivered-ref">
                          / {ref} SP {basketSP ? t('sprints.recommendedBasket') : t('dashboard.plannedSP', 'planifiés')}
                        </span>
                      )}
                    </div>
                    {ref > 0 && <ProgressBar value={pct} max={100} variant="success" />}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="dashboard-sprint__empty">
              <i className="bi bi-calendar3"></i>
              <p>{t('dashboard.noSprints')}</p>
            </div>
          )}
        </Card>

        {/* ===== Right column ===== */}
        <div className="dashboard-page__sidebar">
          {/* Upcoming sprint */}
          <Card variant="outlined" padding="md" className="dashboard-upcoming">
            <h3 className="dashboard-upcoming__title">
              <i className="bi bi-calendar-plus"></i>
              {t('dashboard.upcomingSprint')}
            </h3>
            {upcomingSprint ? (
              <div className="dashboard-upcoming__content">
                <div className="dashboard-upcoming__name">
                  {upcomingSprint.name}
                  {upcomingSprint.jiraId != null && (
                    <Badge variant="info" rounded size="sm" title={t('sprints.jiraLinkedBadge')}>
                      <i className="bi bi-link-45deg" /> Jira
                    </Badge>
                  )}
                </div>
                <div className="dashboard-upcoming__meta">
                  <span>
                    {formatDate(upcomingSprint.startDate)} —{' '}
                    {formatDate(upcomingSprint.endDate)}
                  </span>
                  <Badge variant="default" dot rounded size="sm">
                    {t('dashboard.startsIn', {
                      count: getDaysUntil(upcomingSprint.startDate),
                    })}
                  </Badge>
                </div>
                <div className="dashboard-upcoming__actions">
                  <button className="dashboard-sprint-list__btn" onClick={() => handleEdit(upcomingSprint)} title={t('common.edit')}>
                    <i className="bi bi-pencil" />
                  </button>
                  <button className="dashboard-sprint-list__btn dashboard-sprint-list__btn--success" onClick={() => handleActivate(upcomingSprint)} title={t('sprints.activate')}>
                    <i className="bi bi-play-fill" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="dashboard-upcoming__empty">
                {t('dashboard.noUpcomingSprints')}
              </p>
            )}
          </Card>

          {/* Quick stats */}
          <Card variant="outlined" padding="md" className="dashboard-stats">
            <h3 className="dashboard-stats__title">
              <i className="bi bi-graph-up"></i>
              {t('dashboard.quickStats')}
            </h3>
            {velocityStats ? (
              <div className="dashboard-stats__content">
                {/* Vélocité — moyenne des 3 derniers sprints + mini-courbe */}
                <div className="dashboard-stats__item dashboard-stats__item--wide">
                  <div className="dashboard-stats__value-row">
                    <span className="dashboard-stats__value">
                      {velocityStats.avg !== null ? velocityStats.avg.toFixed(1) : '—'}
                      {velocityStats.avg !== null && <small> SP/j</small>}
                    </span>
                    {velocityStats.velSeries?.length >= 2 && (
                      <Sparkline values={velocityStats.velSeries} />
                    )}
                  </div>
                  <span className="dashboard-stats__label">
                    {t('dashboard.avgVelocity')}
                    {velocityStats.count > 0 && (
                      <>
                        {' — '}
                        <span className="dashboard-stats__window">
                          {t('dashboard.lastNSprints', { count: velocityStats.count, defaultValue: `${velocityStats.count} derniers sprints` })}
                        </span>
                      </>
                    )}
                    {velocityStats.hasDeclineAlert && (
                      <span className="dashboard-stats__alert-dot" title={t('dashboard.declineAlert', 'Baisse sur 3 sprints consécutifs')} />
                    )}
                  </span>
                </div>

                {/* Panier recommandé moyen */}
                <div className="dashboard-stats__item">
                  <span className="dashboard-stats__value">
                    {velocityStats.avgBasket !== null ? velocityStats.avgBasket : '—'}
                    {velocityStats.avgBasket !== null && <small> SP</small>}
                  </span>
                  <span className="dashboard-stats__label">
                    {t('dashboard.avgBasket', 'Panier recommandé moyen')}
                  </span>
                </div>

                {/* Évolution du panier moyen (tendance) */}
                <div className="dashboard-stats__item">
                  {velocityStats.basketTrendDir !== null ? (
                    <>
                      <span className={`dashboard-stats__value dashboard-stats__value--trend-${velocityStats.basketTrendDir}`}>
                        {velocityStats.basketTrendDir === 'increasing' ? '↗' : velocityStats.basketTrendDir === 'decreasing' ? '↘' : '→'}
                        {' '}
                        <span className="dashboard-stats__delta">
                          {velocityStats.basketDeltaPercent > 0 ? '+' : ''}{velocityStats.basketDeltaPercent}%
                        </span>
                      </span>
                      <span className="dashboard-stats__label">
                        {t('dashboard.basketTrend', 'Évolution du panier')}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="dashboard-stats__value dashboard-stats__value--muted">—</span>
                      <span className="dashboard-stats__label">
                        {t('dashboard.basketTrend', 'Évolution du panier')}
                        <small className="dashboard-stats__label-hint">
                          {' '}({velocityStats.basketCount}/2 sprints)
                        </small>
                      </span>
                    </>
                  )}
                </div>

                {/* Link to velocity history */}
                <button
                  className="dashboard-stats__see-more"
                  onClick={() => setDashboardTab('velocity')}
                >
                  {t('dashboard.seeAnalysis', 'Voir l\'analyse')}
                  <i className="bi bi-arrow-right ms-1" />
                </button>
              </div>
            ) : (
              <p className="dashboard-stats__empty">{t('dashboard.noData')}</p>
            )}
          </Card>
        </div>
      </div>

      {/* ===== Bottom Tabbed Section ===== */}
      <div className="dashboard-page__tabs-section">
        <div className="dashboard-page__tabs-header">
          <Tabs
            tabs={[
              { id: 'sprints', label: <><i className="bi bi-clock-history me-2" />{t('dashboard.sprintHistory', 'Historique des sprints')}</> },
              { id: 'velocity', label: <><i className="bi bi-bar-chart-fill me-2" />{t('dashboard.velocityHistory')}</> },
            ]}
            activeTab={dashboardTab}
            onTabChange={setDashboardTab}
            variant="underline"
          />
          {dashboardTab === 'sprints' && (
            <Link to="/sprints" className="dashboard-page__manage-link">
              {t('dashboard.manageSprints', 'Gérer les sprints')}
              <i className="bi bi-arrow-right ms-1" />
            </Link>
          )}
        </div>

        {/* Sprint history tab — closed sprints only, most recent first */}
        {dashboardTab === 'sprints' && (() => {
          const closedOnly = sprints
            .filter(s => s.status === 'closed')
            .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
          return (
          <div className="dashboard-page__tab-pane">
            {closedOnly.length === 0 ? (
              <div className="dashboard-chart__empty">
                <i className="bi bi-hourglass"></i>
                <p>{t('dashboard.noClosedSprintsYet', 'Aucun sprint clôturé pour le moment')}</p>
              </div>
            ) : (
              <div className="dashboard-sprint-list__table-wrap">
                <table className="dashboard-sprint-list__table">
                  <thead>
                    <tr>
                      <th>{t('sprints.name')}</th>
                      <th>{t('sprints.dates')}</th>
                      <th>{t('sprints.workingDays')}</th>
                      <th>{t('sprints.capacity')}</th>
                      <th>{t('sprints.velocity')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedOnly.map(sprint => (
                      <tr key={sprint._id}>
                        <td>
                          <span className="dashboard-sprint-list__name">{sprint.name}</span>
                          {sprint.goal && <div className="dashboard-sprint-list__goal">{sprint.goal}</div>}
                        </td>
                        <td className="dashboard-sprint-list__dates">
                          {formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}
                        </td>
                        <td className="dashboard-sprint-list__working-days">
                          {sprint.capacity?.workingDays > 0 ? sprint.capacity.workingDays : '—'}
                        </td>
                        <td className="dashboard-sprint-list__capacity">
                          {sprint.capacity?.planned?.toFixed(1) || 0} j
                          {sprint.capacity?.actual && (
                            <span className="dashboard-sprint-list__actual">
                              / {sprint.capacity.actual.toFixed(1)} j réels
                            </span>
                          )}
                        </td>
                        <td className="dashboard-sprint-list__velocity">
                          <span className="dashboard-sprint-list__velocity-value">
                            {sprint.velocity?.actual || 0} SP/j
                          </span>
                          {sprint.deliveredStoryPoints > 0 && (
                            <span className="dashboard-sprint-list__sp">
                              {sprint.deliveredStoryPoints} SP
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          );
        })()}

        {/* Velocity tab */}
        {dashboardTab === 'velocity' && (
          <div className="dashboard-page__tab-pane">
            {velocityChartData.length > 0 ? (
              <>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={velocityChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="velocity"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'SP/j', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9CA3AF' } }}
                  />
                  <YAxis
                    yAxisId="capacity"
                    orientation="right"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'jours', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#9CA3AF' } }}
                  />
                  <Tooltip content={<VelocityTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) => <span style={{ color: '#6B7280' }}>{value}</span>}
                  />
                  <Bar yAxisId="velocity" dataKey="velocity" name={t('dashboard.spPerDay')} fill="#1A1A1A" radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar yAxisId="capacity" dataKey="capacityPlanned" name={t('dashboard.plannedCapacity')} fill="#D9CFBB" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar yAxisId="capacity" dataKey="capacityActual" name={t('dashboard.actualCapacity')} fill="#B7A98C" radius={[4, 4, 0, 0]} barSize={20} />
                  <Line yAxisId="velocity" type="monotone" dataKey="velocity" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4, fill: '#F59E0B' }} legendType="none" />
                </ComposedChart>
              </ResponsiveContainer>

              {/* Panier recommandé vs SP livrés (en SP) */}
              <h4 className="dashboard-chart__subtitle">{t('dashboard.basketVsDelivered')}</h4>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={velocityChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false}
                    label={{ value: 'SP', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9CA3AF' } }} />
                  <Tooltip
                    formatter={(value, name) => [value != null ? `${value} SP` : '—', name]}
                    labelFormatter={(l, p) => p?.[0]?.payload?.fullName || l}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span style={{ color: '#6B7280' }}>{value}</span>} />
                  <Bar dataKey="basket" name={t('sprints.recommendedBasket')} fill="#FBBF24" radius={[4, 4, 0, 0]} barSize={24} />
                  <Line type="monotone" dataKey="spDelivered" name={t('dashboard.deliveredSP')} stroke="#16A34A" strokeWidth={2} dot={{ r: 4, fill: '#16A34A' }} />
                </ComposedChart>
              </ResponsiveContainer>
              </>
            ) : (
              <div className="dashboard-chart__empty">
                <i className="bi bi-bar-chart"></i>
                <p>{t('dashboard.noClosedSprints')}</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ===== Sprint Modals ===== */}
      <SprintFormModal
        open={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSubmit={handleSubmit}
        sprint={currentSprint}
        sprints={sprints}
        teamMembers={teamMembers}
        capacityPreview={capacityPreview}
        onFormChange={handleFormChange}
        onTeamReordered={() => getTeamMembers().then((r) => setTeamMembers(r.data || [])).catch(() => {})}
        loading={submitting}
      />

      <CloseSprintModal
        open={showCloseModal}
        onClose={() => { setShowCloseModal(false); setCurrentSprint(null); }}
        onSubmit={handleCloseSprint}
        sprint={currentSprint}
        loading={submitting}
      />

    </div>
  );
};

export default Dashboard;
