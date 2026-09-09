import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useToast } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import { ConfirmationModal } from '../ui';
import JiraSprintPicker from './JiraSprintPicker';
import SprintJiraLinker from './SprintJiraLinker';
import { getHolidaysByDateRange, createHoliday } from '../../services/holidayService';
import { getVelocityEstimate } from '../../services/sprintService';
import { getDaysOffForRange } from '../../services/timeoffService';
import { reorderTeamMembers } from '../../services/teamMemberService';
import './SprintFormModal.css';

/**
 * Sprint creation/editing modal — « Feuille éditoriale » (esthétique Chanel).
 * Accordéon en 4 sections : 01 Cadrage · 02 Équipe · 03 Contraintes · 04 Capacité.
 * Toute la logique métier (congés, jours fériés, capacité, Jira, unsaved) est
 * conservée ; seule la présentation change (double calendrier, lignes d'équipe,
 * sliders de contraintes, carte « panier recommandé »).
 */

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DEV_ROLES = ['developpeur', 'developpeur_junior', 'developpeur_confirme', 'developpeur_senior', 'tech_lead'];
const DEFAULT_VELOCITY = 1.5;

const formatRole = (role) => ({
  tech_lead: 'Tech Lead',
  developpeur: 'Développeur',
  developpeur_junior: 'Dev Junior',
  developpeur_confirme: 'Dev Confirmé',
  developpeur_senior: 'Dev Senior',
}[role] || role);

// --- Helpers dates (local, sans dérive TZ) ---
const pad = (n) => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m 0-based
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m: m - 1, d }; };
const fmtShort = (iso) => { if (!iso) return ''; const { m, d } = parseISO(iso); return `${d} ${SHORT[m]}`; };

// Prochain jour ouvré après une date
function nextBusinessDay(dateStr) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
}

// Date de fin = date de début + 13 jours (2 semaines calendaires)
function calculateEndDate(startDateStr) {
  const date = new Date(startDateStr);
  date.setDate(date.getDate() + 13);
  return date.toISOString().split('T')[0];
}

// Extraire et incrémenter le numéro de sprint
function nextSprintName(lastSprintName) {
  const match = lastSprintName.match(/(\d+)\s*$/);
  if (match) {
    const prefix = lastSprintName.slice(0, match.index);
    return prefix + (parseInt(match[1]) + 1);
  }
  return '';
}

/* ==========================================================================
   Double calendrier — sélection d'une plage de dates
   ========================================================================== */
function RangeCalendar({ startDate, endDate, disabled, onSelect, holidays = {} }) {
  const [anchor, setAnchor] = useState(() => {
    if (startDate) { const b = parseISO(startDate); return { y: b.y, m: b.m }; }
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });
  const [pending, setPending] = useState(null);
  const [hover, setHover] = useState(null);

  const shift = (delta) => {
    setAnchor(({ y, m }) => {
      let nm = m + delta, ny = y;
      if (nm < 0) { nm = 11; ny--; }
      if (nm > 11) { nm = 0; ny++; }
      return { y: ny, m: nm };
    });
  };

  const handleDay = (iso) => {
    if (disabled) return;
    if (!pending) {
      setPending(iso);
      setHover(iso);
    } else {
      const lo = iso < pending ? iso : pending;
      const hi = iso < pending ? pending : iso;
      onSelect(lo, hi);
      setPending(null);
      setHover(null);
    }
  };

  // Bornes affichées (plage confirmée, ou plage en cours de sélection)
  let lo, hi;
  if (pending) {
    const other = hover || pending;
    lo = pending < other ? pending : other;
    hi = pending < other ? other : pending;
  } else {
    lo = startDate; hi = endDate;
  }

  const renderMonth = (offset) => {
    let m = anchor.m + offset, y = anchor.y;
    if (m > 11) { m -= 12; y++; }
    const lead = (new Date(y, m, 1).getDay() + 6) % 7; // lundi = 0
    const dim = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let j = 0; j < lead; j++) cells.push(<button key={`b${j}`} type="button" className="sprc-day sprc-day--blank" tabIndex={-1} aria-hidden="true" />);
    for (let day = 1; day <= dim; day++) {
      const iso = toISO(y, m, day);
      const w = new Date(y, m, day).getDay();
      const holidayName = holidays[iso];
      const cls = ['sprc-day'];
      if (w === 0 || w === 6) cls.push('sprc-day--we');
      if (lo && hi && iso >= lo && iso <= hi) cls.push('sprc-day--in');
      if (iso === lo || (hi && iso === hi)) cls.push('sprc-day--edge');
      if (holidayName) cls.push('sprc-day--holiday');
      cells.push(
        <button
          key={iso}
          type="button"
          className={cls.join(' ')}
          onClick={() => handleDay(iso)}
          onMouseEnter={() => pending && setHover(iso)}
          disabled={disabled}
          title={holidayName || undefined}
        >
          {day}
          {holidayName && <span className="sprc-day__dot" aria-hidden="true" />}
        </button>
      );
    }
    return (
      <div className="sprc-cal" key={offset}>
        <div className="sprc-nav">
          <button type="button" onClick={() => shift(-1)} style={offset ? { visibility: 'hidden' } : undefined} aria-label="Mois précédent">‹</button>
          <span className="sprc-nav__title">{MONTHS[m]} {y}</span>
          <button type="button" onClick={() => shift(1)} style={offset ? undefined : { visibility: 'hidden' }} aria-label="Mois suivant">›</button>
        </div>
        <div className="sprc-grid">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x, i) => <div key={i} className="sprc-head-cell">{x}</div>)}
        </div>
        <div className="sprc-grid sprc-grid--days">{cells}</div>
      </div>
    );
  };

  return <div className="sprs-cals">{renderMonth(0)}{renderMonth(1)}</div>;
}

/* ==========================================================================
   Section d'accordéon
   ========================================================================== */
function Section({ num, title, summary, open, onToggle, action, children }) {
  return (
    <div className="sprs-sec">
      <div className="sprs-sec__head">
        <button type="button" className="sprs-sec__toggle" onClick={onToggle} aria-expanded={open}>
          <span className="sprs-sec__num">{num}</span>
          <span className="sprs-sec__title">{title}</span>
          <span className="sprs-sec__sum">{summary}</span>
        </button>
        {action && <div className="sprs-sec__action">{action}</div>}
        <button type="button" className="sprs-sec__sign" onClick={onToggle} aria-label={open ? 'Replier' : 'Déplier'}>
          {open ? '−' : '+'}
        </button>
      </div>
      {open && <div className="sprs-sec__body">{children}</div>}
    </div>
  );
}

const SprintFormModal = ({
  open,
  onClose,
  onSubmit,
  sprint = null,
  sprints = [],
  teamMembers = [],
  capacityPreview = null,
  onFormChange,
  onTeamReordered,
  loading = false,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = !!sprint;
  const isLocked = sprint?.status === 'closed';

  // Sections ouvertes (Contraintes fermée par défaut, comme la maquette)
  const [openSecs, setOpenSecs] = useState({ info: true, team: true, cons: false, cap: true });
  const toggleSec = (k) => setOpenSecs((prev) => ({ ...prev, [k]: !prev[k] }));

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
    team: [],
    constraints: { meetingsPercent: 10, bugsPercent: 10, tnrPercent: 5 },
  });

  const {
    isDirty,
    markDirty,
    resetDirty,
    showConfirmDialog,
    requestDiscard,
    confirmDiscard,
    cancelDiscard,
  } = useUnsavedChanges();

  // Holidays
  const [holidays, setHolidays] = useState([]);
  const [excludedHolidayIds, setExcludedHolidayIds] = useState(new Set());
  const filteredHolidayDatesRef = useRef([]);
  const [holidayFormOpen, setHolidayFormOpen] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayCountry, setNewHolidayCountry] = useState('MA');
  const [addingHoliday, setAddingHoliday] = useState(false);

  // Jours ouvrés (client-side, tient compte des fériés actifs)
  const clientWorkingDays = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return 0;
    const activeHolidayTimestamps = new Set(
      holidays.filter((h) => !excludedHolidayIds.has(h._id)).map((h) => new Date(h.date).setHours(0, 0, 0, 0))
    );
    let count = 0;
    const cur = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6 && !activeHolidayTimestamps.has(cur.setHours(0, 0, 0, 0))) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }, [formData.startDate, formData.endDate, holidays, excludedHolidayIds]);

  const [velocityEstimate, setVelocityEstimate] = useState(null);
  const [autoDaysOff, setAutoDaysOff] = useState({});

  // Reset à l'ouverture
  useEffect(() => {
    if (open) {
      if (sprint) {
        setFormData({
          name: sprint.name || '',
          goal: sprint.goal || '',
          startDate: sprint.startDate ? sprint.startDate.split('T')[0] : '',
          endDate: sprint.endDate ? sprint.endDate.split('T')[0] : '',
          team: sprint.team?.map((tm) => ({
            member: tm.member?._id || tm.member,
            availability: tm.availability ?? 100,
            daysOff: tm.daysOff ?? 0,
          })) || [],
          constraints: sprint.constraints || { meetingsPercent: 10, bugsPercent: 10, tnrPercent: 5 },
        });
      } else {
        let autoName = '', autoStartDate = '', autoEndDate = '';
        if (sprints.length > 0) {
          const sorted = [...sprints].sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
          const lastSprint = sorted[0];
          autoName = nextSprintName(lastSprint.name);
          if (lastSprint.endDate) {
            autoStartDate = nextBusinessDay(lastSprint.endDate.split('T')[0]);
            autoEndDate = calculateEndDate(autoStartDate);
          }
        }
        setFormData({
          name: autoName, goal: '', startDate: autoStartDate, endDate: autoEndDate,
          team: [], constraints: { meetingsPercent: 10, bugsPercent: 10, tnrPercent: 5 },
        });
      }
      setOpenSecs({ info: true, team: true, cons: false, cap: true });
      setHolidayFormOpen(false);
      resetDirty();
    }
    // On ne réinitialise qu'à l'ouverture ou au changement de sprint édité —
    // surtout pas quand la liste `sprints` change (sinon la sélection d'équipe
    // serait effacée à chaque recalcul de capacité).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sprint?._id]);

  // Recharge les fériés de la période
  const reloadHolidays = useCallback(() => {
    if (formData.startDate && formData.endDate) {
      return getHolidaysByDateRange(formData.startDate, formData.endDate)
        .then((result) => setHolidays(result.data || []))
        .catch(() => setHolidays([]));
    }
    setHolidays([]);
    return Promise.resolve();
  }, [formData.startDate, formData.endDate]);

  useEffect(() => {
    setExcludedHolidayIds(new Set());
    if (open) reloadHolidays();
    else setHolidays([]);
  }, [open, reloadHolidays]);

  // Congés par membre sur la période
  useEffect(() => {
    if (open && formData.startDate && formData.endDate) {
      getDaysOffForRange(formData.startDate, formData.endDate)
        .then((r) => setAutoDaysOff(r.daysOff || {}))
        .catch(() => setAutoDaysOff({}));
    } else {
      setAutoDaysOff({});
    }
  }, [open, formData.startDate, formData.endDate]);

  // Estimation de vélocité (dès l'ouverture, pour le panier de la section Capacité)
  useEffect(() => {
    if (open && !velocityEstimate) {
      getVelocityEstimate(3).then((result) => setVelocityEstimate(result.data)).catch(() => setVelocityEstimate(null));
    }
    if (!open) setVelocityEstimate(null);
  }, [open, velocityEstimate]);

  // Notifie le parent (recalcul de capacité côté serveur)
  useEffect(() => {
    const filteredHolidayDates = holidays.filter((h) => !excludedHolidayIds.has(h._id)).map((h) => h.date);
    filteredHolidayDatesRef.current = filteredHolidayDates;
    if (onFormChange && open) onFormChange(formData, filteredHolidayDates);
  }, [formData, onFormChange, open, holidays, excludedHolidayIds]);

  const handleAddHoliday = async () => {
    if (!newHolidayDate || !newHolidayName.trim()) {
      showToast({ type: 'warning', message: t('holidays.addFillRequired') });
      return;
    }
    setAddingHoliday(true);
    try {
      await createHoliday({ date: newHolidayDate, name: newHolidayName.trim(), country: newHolidayCountry });
      await reloadHolidays();
      setNewHolidayDate('');
      setNewHolidayName('');
      showToast({ type: 'success', message: t('holidays.addedToSprint') });
    } catch (e) {
      showToast({ type: 'error', message: e.response?.data?.message || e.message });
    } finally {
      setAddingHoliday(false);
    }
  };

  // --- Champs simples ---
  const handleChange = useCallback((field, value) => {
    markDirty();
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'startDate' && value && !isEditing) updated.endDate = calculateEndDate(value);
      return updated;
    });
  }, [markDirty, isEditing]);

  // Sélection de plage via le double calendrier
  const handleRangeSelect = useCallback((start, end) => {
    markDirty();
    setFormData((prev) => ({ ...prev, startDate: start, endDate: end }));
  }, [markDirty]);

  const handleJiraSprintPick = useCallback((js) => {
    markDirty();
    setFormData((prev) => ({
      ...prev,
      name: js.name || prev.name,
      startDate: js.startDate ? js.startDate.split('T')[0] : prev.startDate,
      endDate: js.endDate ? js.endDate.split('T')[0] : prev.endDate,
    }));
  }, [markDirty]);

  const handleConstraintChange = useCallback((field, value) => {
    markDirty();
    setFormData((prev) => ({ ...prev, constraints: { ...prev.constraints, [field]: parseInt(value) || 0 } }));
  }, [markDirty]);

  // --- Équipe : le pré-remplissage des congés ne touche QUE les nouveaux membres ---
  const commitTeam = useCallback((team) => {
    markDirty();
    setFormData((prev) => {
      const prevIds = new Set(prev.team.map((tm) => tm.member));
      const adjusted = team.map((entry) => {
        if (!prevIds.has(entry.member)) {
          const auto = autoDaysOff[entry.member];
          if (auto != null) return { ...entry, daysOff: auto };
        }
        return entry;
      });
      return { ...prev, team: adjusted };
    });
  }, [markDirty, autoDaysOff]);

  const toggleMember = useCallback((memberId) => {
    if (isLocked) return;
    const exists = formData.team.some((tm) => tm.member === memberId);
    if (exists) commitTeam(formData.team.filter((tm) => tm.member !== memberId));
    else commitTeam([...formData.team, { member: memberId, availability: 100, daysOff: 0 }]);
  }, [isLocked, formData.team, commitTeam]);

  const setAvail = useCallback((memberId, v) => {
    if (isLocked) return;
    commitTeam(formData.team.map((tm) => (tm.member === memberId ? { ...tm, availability: v } : tm)));
  }, [isLocked, formData.team, commitTeam]);

  const stepOff = useCallback((memberId, delta) => {
    if (isLocked) return;
    commitTeam(formData.team.map((tm) => (
      tm.member === memberId ? { ...tm, daysOff: Math.min(clientWorkingDays, Math.max(0, (tm.daysOff || 0) + delta)) } : tm
    )));
  }, [isLocked, formData.team, commitTeam, clientWorkingDays]);

  const selectAllMembers = useCallback((members) => {
    if (isLocked) return;
    const current = new Set(formData.team.map((tm) => tm.member));
    const toAdd = members.filter((m) => !current.has(m._id)).map((m) => ({ member: m._id, availability: 100, daysOff: 0 }));
    commitTeam([...formData.team, ...toAdd]);
  }, [isLocked, formData.team, commitTeam]);

  const handleRecalcDaysOff = useCallback(() => {
    markDirty();
    setFormData((prev) => ({ ...prev, team: prev.team.map((entry) => ({ ...entry, daysOff: autoDaysOff[entry.member] || 0 })) }));
  }, [markDirty, autoDaysOff]);

  // --- Fermeture / soumission ---
  const handleClose = useCallback(() => { requestDiscard(onClose); }, [requestDiscard, onClose]);
  const handleSubmit = useCallback(() => {
    resetDirty();
    onSubmit(formData, filteredHolidayDatesRef.current);
  }, [formData, onSubmit, resetDirty]);

  // Escape + scroll lock
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [open, handleClose]);

  // Membres éligibles (devs / tech leads actifs)
  const eligibleMembers = useMemo(
    () => teamMembers.filter((m) => m.active !== false && DEV_ROLES.includes(m.role)),
    [teamMembers]
  );
  const teamEntry = useCallback((id) => formData.team.find((tm) => tm.member === id), [formData.team]);

  // --- Ordre d'affichage des membres (drag & drop, persisté) ---
  const [orderedIds, setOrderedIds] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  // Resynchronise l'ordre local sur l'ordre serveur (à l'ouverture / refetch)
  useEffect(() => {
    setOrderedIds(eligibleMembers.map((m) => m._id));
  }, [eligibleMembers]);

  const orderedMembers = useMemo(() => {
    const byId = new Map(eligibleMembers.map((m) => [m._id, m]));
    const inOrder = orderedIds.map((id) => byId.get(id)).filter(Boolean);
    const missing = eligibleMembers.filter((m) => !orderedIds.includes(m._id));
    return [...inOrder, ...missing];
  }, [eligibleMembers, orderedIds]);

  const persistOrder = useCallback((ids) => {
    reorderTeamMembers(ids)
      .then(() => { if (onTeamReordered) onTeamReordered(); })
      .catch((e) => showToast({ type: 'error', message: e.message || 'Réordonnancement impossible' }));
  }, [onTeamReordered, showToast]);

  const handleDrop = useCallback((targetId) => {
    setDragOverId(null);
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    setOrderedIds((prev) => {
      const ids = prev.length ? [...prev] : orderedMembers.map((m) => m._id);
      const from = ids.indexOf(dragId);
      const to = ids.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      ids.splice(from, 1);
      ids.splice(to, 0, dragId);
      persistOrder(ids);
      return ids;
    });
    setDragId(null);
  }, [dragId, orderedMembers, persistOrder]);

  // --- Capacité (aperçu live, formule identique à la maquette) ---
  const velocity = velocityEstimate?.average || DEFAULT_VELOCITY;
  const metrics = useMemo(() => {
    const wd = clientWorkingDays;
    const gross = formData.team.reduce((s, e) => s + Math.max(0, wd * (e.availability / 100) - (e.daysOff || 0)), 0);
    const c = formData.constraints;
    const consPct = (c.meetingsPercent + c.bugsPercent + c.tnrPercent) / 100;
    const net = gross * (1 - consPct);
    return {
      wd, gross, consPct, net,
      constraintDays: gross - net,
      meetingsDays: gross * c.meetingsPercent / 100,
      bugsDays: gross * c.bugsPercent / 100,
      tnrDays: gross * c.tnrPercent / 100,
      sp: Math.round(net * velocity),
    };
  }, [clientWorkingDays, formData.team, formData.constraints, velocity]);

  // --- Validation ---
  const isValid = formData.name.trim() && formData.startDate && formData.endDate && formData.team.length > 0;

  // --- Résumés de sections ---
  const rangeLabel = formData.endDate
    ? `${fmtShort(formData.startDate)} → ${fmtShort(formData.endDate)}`
    : `${fmtShort(formData.startDate)} → …`;
  const sumInfo = formData.startDate ? `${rangeLabel} · ${metrics.wd} j ouvrés` : t('sprints.selectTeamAndDates', 'À renseigner');
  const sumTeam = `${formData.team.length} ${t('sprints.members')} · ${metrics.gross.toFixed(1)} j bruts`;
  const sumCons = `${Math.round(metrics.consPct * 100)}% · réunions, bugs, TNR`;
  const sumCap = `${metrics.net.toFixed(1)} j nets · ${metrics.sp} SP`;

  const visibleHolidays = holidays.filter((h) => !excludedHolidayIds.has(h._id));

  // Map des fériés actifs (comptés) → { 'yyyy-mm-dd': nom } pour le calendrier.
  // Conversion en date locale, cohérente avec le calcul des jours ouvrés.
  const holidayMap = useMemo(() => {
    const map = {};
    visibleHolidays.forEach((h) => {
      const d = new Date(h.date);
      map[toISO(d.getFullYear(), d.getMonth(), d.getDate())] = h.name;
    });
    return map;
  }, [visibleHolidays]);

  if (!open) return null;

  return (
    <>
      <div className="sprs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
        <div className="sprs-sheet" role="dialog" aria-modal="true" aria-label={isEditing ? t('sprints.edit') : t('sprints.create')}>
          {/* Header */}
          <div className="sprs-head">
            <div className="sprs-head__left">
              <h2 className="sprs-head__title">{isEditing ? t('sprints.edit') : t('sprints.create')}</h2>
              {isEditing && sprint?.jiraId && (
                <span className="sprs-jira">Jira #{sprint.jiraId}</span>
              )}
            </div>
            <button type="button" className="sprs-icon-btn" onClick={handleClose} aria-label={t('common.close', 'Fermer')}>×</button>
          </div>

          <div className="sprs-scroll">
            {/* 01 · Cadrage */}
            <Section
              num="01"
              title={t('sprints.sprintInfo', 'Cadrage')}
              summary={sumInfo}
              open={openSecs.info}
              onToggle={() => toggleSec('info')}
              action={isEditing && sprint?._id ? <SprintJiraLinker sprint={sprint} /> : null}
            >
              {!isEditing && !isLocked && <JiraSprintPicker onPick={handleJiraSprintPick} />}

              <div className="sprs-fields">
                <label className="sprs-field sprs-field--grow">
                  <span className="sprs-label">{t('sprints.name')}</span>
                  <input
                    className="sprs-in sprs-in--strong"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder={t('sprints.namePlaceholder')}
                    disabled={isLocked}
                  />
                </label>
                <label className="sprs-field sprs-field--grow-2">
                  <span className="sprs-label">{t('sprints.goal')} · {t('common.optional', 'optionnel')}</span>
                  <input
                    className="sprs-in sprs-in--soft"
                    value={formData.goal}
                    onChange={(e) => handleChange('goal', e.target.value)}
                    placeholder={t('sprints.goalPlaceholder')}
                    disabled={isLocked}
                  />
                </label>
              </div>

              {/* Période */}
              <div className="sprs-period">
                <div className="sprs-period__head">
                  <span className="sprs-label">{t('sprints.dates', 'Période')}</span>
                  {visibleHolidays.length > 0 && (
                    <span className="sprs-holiday-legend">
                      <span className="sprc-day__dot sprs-holiday-legend__dot" /> {t('holidays.title', 'Jour férié')}
                    </span>
                  )}
                </div>

                <RangeCalendar
                  startDate={formData.startDate}
                  endDate={formData.endDate}
                  disabled={isLocked}
                  onSelect={handleRangeSelect}
                  holidays={holidayMap}
                />

                <div className="sprs-meta">
                  <span className="sprs-meta__range">{formData.startDate ? rangeLabel : t('sprints.selectTeamAndDates', 'Sélectionnez une période')}</span>
                  <span className="sprs-pill">{metrics.wd} {t('sprints.workingDays')}</span>
                  <span className="sprs-meta__hint">
                    {visibleHolidays.length > 0
                      ? t('holidays.holidaysInSprint') + ` (${visibleHolidays.length})`
                      : t('holidays.noneActive', 'week-ends exclus')}
                  </span>
                  {!isLocked && (
                    <button type="button" className="sprs-link" onClick={() => setHolidayFormOpen((v) => !v)}>
                      {t('holidays.addMissing', 'Ajouter un férié')}
                    </button>
                  )}
                </div>

                {/* Fériés de la période (exclure / réintégrer) */}
                {holidays.length > 0 && (
                  <div className="sprs-holidays">
                    {holidays.map((h) => {
                      const excluded = excludedHolidayIds.has(h._id);
                      return (
                        <button
                          key={h._id}
                          type="button"
                          className={`sprs-hol${excluded ? ' sprs-hol--off' : ''}`}
                          onClick={() => setExcludedHolidayIds((prev) => {
                            const next = new Set(prev);
                            if (excluded) next.delete(h._id); else next.add(h._id);
                            return next;
                          })}
                          title={excluded ? t('holidays.reinclude', 'Réintégrer') : t('holidays.exclude', 'Exclure du calcul')}
                        >
                          <i className={`bi ${excluded ? 'bi-plus-circle' : 'bi-x-circle'}`} />
                          {new Date(h.date).toLocaleDateString()} — {h.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Ajout manuel d'un férié */}
                {holidayFormOpen && !isLocked && (
                  <div className="sprs-holiday-add">
                    <input type="date" className="sprs-in--box" value={newHolidayDate} min={formData.startDate} max={formData.endDate} onChange={(e) => setNewHolidayDate(e.target.value)} />
                    <input className="sprs-in--box sprs-in--box-grow" value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} placeholder={t('holidays.namePlaceholder')} />
                    <select className="sprs-in--box" value={newHolidayCountry} onChange={(e) => setNewHolidayCountry(e.target.value)}>
                      <option value="MA">MA</option>
                      <option value="FR">FR</option>
                    </select>
                    <button type="button" className="sprs-btn sprs-btn--solid" onClick={handleAddHoliday} disabled={addingHoliday}>
                      {addingHoliday ? '…' : t('common.add', 'Ajouter')}
                    </button>
                  </div>
                )}
              </div>
            </Section>

            {/* 02 · Équipe */}
            <Section num="02" title={t('sprints.team', 'Équipe')} summary={sumTeam} open={openSecs.team} onToggle={() => toggleSec('team')}>
              <div className="sprs-team-head">
                <span>{t('sprints.daysOffHint', "Congés importés · survolez une ligne pour ajuster")}</span>
                {!isLocked && (
                  <div className="sprs-team-head__actions">
                    {formData.team.length > 0 && (
                      <button type="button" className="sprs-link" onClick={handleRecalcDaysOff}>
                        <i className="bi bi-arrow-clockwise" /> {t('sprints.recalcDaysOff', 'Recalculer les congés')}
                      </button>
                    )}
                    <button type="button" className="sprs-link" onClick={() => selectAllMembers(eligibleMembers)}>
                      {t('common.selectAll', 'Tout sélectionner')}
                    </button>
                  </div>
                )}
              </div>

              <div className="sprs-team">
                {orderedMembers.length === 0 && (
                  <div className="sprs-team__empty">{t('teamMembers.noMembers')}</div>
                )}
                {orderedMembers.map((m) => {
                  const entry = teamEntry(m._id);
                  const on = !!entry;
                  const initials = `${m.firstName?.[0] || ''}${m.lastName?.[0] || ''}`.toUpperCase();
                  const stop = (e) => e.stopPropagation();
                  const rowCls = `sprs-row${on ? ' sprs-row--on' : ''}${isLocked ? ' sprs-row--locked' : ''}`
                    + `${dragId === m._id ? ' sprs-row--dragging' : ''}${dragOverId === m._id ? ' sprs-row--dragover' : ''}`;
                  return (
                    <div
                      key={m._id}
                      className={rowCls}
                      onClick={() => toggleMember(m._id)}
                      role="button"
                      tabIndex={isLocked ? -1 : 0}
                      onKeyDown={(e) => { if (!isLocked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleMember(m._id); } }}
                      onDragOver={!isLocked ? (e) => { e.preventDefault(); if (dragOverId !== m._id) setDragOverId(m._id); } : undefined}
                      onDragLeave={!isLocked ? () => setDragOverId((cur) => (cur === m._id ? null : cur)) : undefined}
                      onDrop={!isLocked ? (e) => { e.preventDefault(); handleDrop(m._id); } : undefined}
                    >
                      {!isLocked && (
                        <span
                          className="sprs-grip"
                          draggable
                          onClick={stop}
                          onDragStart={(e) => { setDragId(m._id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', m._id); } catch (_) { /* IE */ } }}
                          onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                          title={t('sprints.dragToReorder', 'Glisser pour réordonner')}
                          aria-label={t('sprints.dragToReorder', 'Glisser pour réordonner')}
                        >
                          <i className="bi bi-grip-vertical" />
                        </span>
                      )}
                      <span className="sprs-box" aria-hidden="true">{on ? '✓' : ''}</span>
                      {m.photo
                        ? <img className="sprs-avatar sprs-avatar--img" src={m.photo} alt={`${m.firstName} ${m.lastName}`} />
                        : <span className="sprs-avatar">{initials}</span>}
                      <span className="sprs-who">{m.firstName} {m.lastName}</span>
                      <span className="sprs-role">{formatRole(m.role)}</span>
                      <span className="sprs-spacer" />
                      {on ? (
                        <>
                          <span className="sprs-rest">
                            {entry.availability}%{entry.daysOff ? ` · ${entry.daysOff}j off` : ''}
                          </span>
                          {!isLocked && (
                            <div className="sprs-edit" onClick={stop}>
                              <div className="sprs-avail">
                                {[100, 50, 25].map((v) => (
                                  <button key={v} type="button" className={`sprs-chip sprs-chip--sm${entry.availability === v ? ' sprs-chip--on' : ''}`} onClick={() => setAvail(m._id, v)}>{v}%</button>
                                ))}
                              </div>
                              <div className="sprs-stepper">
                                <button type="button" className="sprs-step" onClick={() => stepOff(m._id, -1)}>−</button>
                                <span className="sprs-off">{entry.daysOff}j off</span>
                                <button type="button" className="sprs-step" onClick={() => stepOff(m._id, 1)}>+</button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="sprs-rest sprs-rest--muted">{t('sprints.outOfSprint', 'Hors sprint')}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* 03 · Contraintes */}
            <Section num="03" title={t('sprints.constraints', 'Contraintes')} summary={sumCons} open={openSecs.cons} onToggle={() => toggleSec('cons')}>
              <p className="sprs-note">{t('sprints.constraintsDescription', 'Reprises du sprint précédent. Ajustez seulement si nécessaire.')}</p>
              <div className="sprs-cons">
                {[
                  ['meetingsPercent', t('sprints.meetingsPercent', 'Réunions'), metrics.meetingsDays],
                  ['bugsPercent', t('sprints.bugsPercent', 'Bugs / incidents'), metrics.bugsDays],
                  ['tnrPercent', t('sprints.tnrPercent', 'TNR'), metrics.tnrDays],
                ].map(([key, label, days]) => (
                  <div key={key} className="sprs-cons-row">
                    <span className="sprs-label sprs-cons-row__label">{label}</span>
                    <input type="range" min={0} max={40} step={5} value={formData.constraints[key]} onChange={(e) => handleConstraintChange(key, e.target.value)} disabled={isLocked} className="sprs-range" />
                    <span className="sprs-cons-row__pct">{formData.constraints[key]}%</span>
                    <span className="sprs-cons-row__days">{days.toFixed(1)} j</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* 04 · Capacité */}
            <Section num="04" title={t('sprints.capacityPreview', 'Capacité')} summary={sumCap} open={openSecs.cap} onToggle={() => toggleSec('cap')}>
              <div className="sprs-cap">
                <div className="sprs-cap__left">
                  <div className="sprs-metrics">
                    {[
                      [t('sprints.workingDays', 'Jours ouvrés'), `${metrics.wd} j`],
                      [t('sprints.grossCapacity', 'Capacité brute'), `${metrics.gross.toFixed(1)} j`],
                      [t('sprints.constraintsTotal', 'Contraintes'), `−${metrics.constraintDays.toFixed(1)} j`],
                      [t('sprints.netCapacity', 'Capacité nette'), `${metrics.net.toFixed(1)} j`],
                    ].map(([label, val]) => (
                      <div key={label} className="sprs-metric">
                        <span className="sprs-metric__label">{label}</span>
                        <span className="sprs-metric__value">{val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="sprs-bar"><div className="sprs-bar__fill" style={{ width: `${Math.round((1 - metrics.consPct) * 100)}%` }} /></div>
                  <div className="sprs-legend">
                    {Math.round((1 - metrics.consPct) * 100)}% {t('sprints.netCapacity', 'de capacité nette')} · réunions {metrics.meetingsDays.toFixed(1)} j · bugs {metrics.bugsDays.toFixed(1)} j · TNR {metrics.tnrDays.toFixed(1)} j
                  </div>
                </div>
                <div className="sprs-basket">
                  <span className="sprs-label">{t('sprints.recommendedBasket', 'Panier recommandé')}</span>
                  <span className="sprs-basket__big">{metrics.sp} SP</span>
                  <span className="sprs-basket__formula">{metrics.net.toFixed(1)} j × {velocity} SP/j</span>
                  <div className="sprs-basket__rule" />
                  <span className="sprs-basket__foot">
                    {velocityEstimate && velocityEstimate.sprintsAnalyzed > 0
                      ? t('sprints.lastNSprints', { count: velocityEstimate.sprintsAnalyzed })
                      : `${t('sprints.avgVelocity', 'Vélocité')} ${velocity} SP/j`}
                  </span>
                </div>
              </div>
            </Section>
          </div>

          {/* Footer */}
          <div className="sprs-foot">
            <span className="sprs-foot__note">
              {isEditing
                ? (isDirty ? t('common.unsavedChanges', 'Modifications non enregistrées.') : '')
                : t('sprints.draftPrefilled', 'Brouillon pré-rempli · ajustez au besoin')}
            </span>
            <div className="sprs-foot__actions">
              <button type="button" className="sprs-btn sprs-btn--ghost" onClick={handleClose} disabled={loading}>{t('common.cancel')}</button>
              {!isLocked && (
                <button type="button" className="sprs-btn sprs-btn--solid" onClick={handleSubmit} disabled={!isValid || loading}>
                  {loading ? '…' : (isEditing ? t('common.save') : t('common.create'))}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        open={showConfirmDialog}
        onClose={cancelDiscard}
        onConfirm={confirmDiscard}
        title={t('common.unsavedChanges') || 'Modifications non sauvegardées'}
        message={t('common.unsavedChangesMessage') || 'Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?'}
        confirmText={t('common.discard') || 'Quitter'}
        cancelText={t('common.stay') || 'Rester'}
        variant="warning"
      />
    </>
  );
};

export default SprintFormModal;
