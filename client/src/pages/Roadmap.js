import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Spinner, useToast, Modal, Input } from '@frhamon/design-system';
import * as epicService from '../services/epicService';
import Tabs from '../components/ui/Tabs';
import TeamAvailabilityModal from '../components/sprint/TeamAvailabilityModal';
import { getCapacityStream, getTimeOff } from '../services/timeoffService';
import { getHolidaysByDateRange } from '../services/holidayService';
import { generateNextSprints } from '../services/sprintService';
import { getTeamMembers } from '../services/teamMemberService';
import '../styles/Roadmap.css';

// Horizon pluriannuel : indices de mois ABSOLUS à partir de janvier BASE_YEAR.
// (mois 0 = janv. BASE_YEAR, mois 12 = janv. année suivante, etc.)
const BASE_YEAR = new Date().getFullYear();
const HORIZON_YEARS = 3;
const TOTAL_MONTHS = HORIZON_YEARS * 12;
const yearOfIndex = (idx) => BASE_YEAR + Math.floor(idx / 12);
const monthCapOf = (idx) => MONTHS_CAP[((Math.floor(idx) % 12) + 12) % 12];
const monthShOf = (idx) => MONTHS_SH[((Math.floor(idx) % 12) + 12) % 12];

// Index de mois flottant (mois + fraction de jour) absolu depuis janv. BASE_YEAR.
// Clampé légèrement hors bornes pour les dates hors horizon.
const monthFloatOf = (date) => {
  const d = new Date(date);
  const idx = (d.getFullYear() - BASE_YEAR) * 12 + d.getMonth() + (d.getDate() - 1) / 31;
  if (idx < -0.5) return -1;
  if (idx > TOTAL_MONTHS) return TOTAL_MONTHS + 1;
  return idx;
};

const availabilityColor = (pct) => {
  if (pct >= 80) return '#3F8068';
  if (pct >= 50) return '#B8941F';
  return '#B5717E';
};

const memberInitials = (m) =>
  `${m?.firstName?.charAt(0) || ''}${m?.lastName?.charAt(0) || ''}`.toUpperCase();

const memberAvatarUrl = (m) => {
  if (m?.photo) return m.photo;
  return `https://ui-avatars.com/api/?name=${memberInitials(m) || '?'}&background=5B6B7A&color=fff&size=48`;
};

const MONTHS_CAP = ['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];
const MONTHS_SH = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
const MONTH_WIDTH = 116;
// Largeur d'affichage de la fenêtre visible (indépendante de l'horizon total :
// la fenêtre `viewMonths` est toujours mappée sur cette largeur).
const TIMELINE_WIDTH = MONTH_WIDTH * 12;

// Tailles T-shirt exprimées en SPRINTS (décimales autorisées, ex. 0.5 = demi-sprint).
const DEFAULT_SIZES = { XS: 0.5, S: 1, M: 2, L: 3, XL: 5 };
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL'];
const SIZE_WEIGHT = { XS: 1, S: 2, M: 3, L: 5, XL: 8 };
const SIZES_STORAGE_KEY = 'potool-roadmap-sizes-v2'; // v2 : unité = sprints (avant : mois)

// Conversion sprint -> mois pour le placement sur l'axe mensuel (sprint = 2 semaines, ~26/an).
const MONTHS_PER_SPRINT = 12 / 26;

// Durées (en sprints) configurables derrière chaque taille T-shirt, persistées en localStorage.
const loadSizes = () => {
  try {
    const raw = localStorage.getItem(SIZES_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') return { ...DEFAULT_SIZES, ...p };
    }
  } catch (e) { /* noop */ }
  return { ...DEFAULT_SIZES };
};

const STATUS_META = {
  done:     { label: 'Terminé',  color: '#1F1F1F' },
  progress: { label: 'En cours', color: '#4F46E5' },
  planned:  { label: 'Planifié', color: '#A3A3A3' },
  risk:     { label: 'À risque', color: '#B8941F' },
};

const DIVISION_PALETTE = [
  { color: '#4F46E5', tint: 'rgba(79,70,229,0.08)',  border: 'rgba(79,70,229,0.35)'  },
  { color: '#B8941F', tint: 'rgba(184,148,31,0.09)', border: 'rgba(184,148,31,0.45)' },
  { color: '#B5717E', tint: 'rgba(181,113,126,0.10)',border: 'rgba(181,113,126,0.45)'},
  { color: '#8C6D46', tint: 'rgba(140,109,70,0.10)', border: 'rgba(140,109,70,0.45)' },
  { color: '#5B6B7A', tint: 'rgba(91,107,122,0.10)', border: 'rgba(91,107,122,0.45)' },
  { color: '#3F8068', tint: 'rgba(63,128,104,0.10)', border: 'rgba(63,128,104,0.45)' },
  { color: '#8A8A8A', tint: 'rgba(138,138,138,0.10)',border: 'rgba(138,138,138,0.40)'},
];

const BUILDER_STORAGE_KEY = 'potool-roadmap-builder-v1';

const TODAY = new Date();
const TODAY_MONTH_INDEX = (() => {
  const idx = (TODAY.getFullYear() - BASE_YEAR) * 12 + TODAY.getMonth() + (TODAY.getDate() - 1) / 31;
  return idx >= 0 && idx <= TOTAL_MONTHS ? idx : -1;
})();

const slugifyCategory = (cat) => (cat || 'autres').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'autres';

const computeStatus = (epic) => {
  if (epic.status === 'done') return 'done';
  if (epic.status === 'in_progress' || epic.status === 'review') return 'progress';
  if (epic.dueDate && new Date(epic.dueDate) < TODAY && epic.status !== 'cancelled') return 'risk';
  return 'planned';
};

const computeProgress = (status) => {
  if (status === 'done') return 1;
  if (status === 'progress') return 0.5;
  if (status === 'risk') return 0.3;
  return 0;
};

const monthIndex = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const idx = (d.getFullYear() - BASE_YEAR) * 12 + d.getMonth();
  if (idx < 0 || idx >= TOTAL_MONTHS) return null;
  return idx;
};

const buildDivisions = (epics) => {
  const buckets = new Map();
  epics.forEach((e) => {
    const key = slugifyCategory(e.category);
    const displayName = e.category || 'Autres';
    if (!buckets.has(key)) buckets.set(key, { key, name: displayName, epics: [] });
    buckets.get(key).epics.push(e);
  });
  const arr = [...buckets.values()];
  arr.sort((a, b) => {
    const sa = a.epics.reduce((s, e) => s + epicSp(e), 0);
    const sb = b.epics.reduce((s, e) => s + epicSp(e), 0);
    return sb - sa;
  });
  return arr.map((d, i) => ({ ...d, ...DIVISION_PALETTE[i % DIVISION_PALETTE.length] }));
};

// SP d'un epic : total des enfants (les SP Jira sont portés par les stories), sinon les siens.
const epicSp = (e) => (e && e.childrenTotalSP != null ? e.childrenTotalSP : (Number(e && e.storyPoints) || 0));

const mapEpicForRoadmap = (e, division) => {
  // Étendue calée sur les sprints reliés (qui vont jusqu'à fin d'année) ET sur les dates.
  let sprintStart = null;
  let sprintEnd = null;
  if (Array.isArray(e.sprints)) {
    e.sprints.forEach((s) => {
      const ms = monthIndex(s && s.startDate);
      const me = monthIndex(s && s.endDate);
      if (ms != null) sprintStart = sprintStart == null ? ms : Math.min(sprintStart, ms);
      if (me != null) sprintEnd = sprintEnd == null ? me : Math.max(sprintEnd, me);
    });
  }
  const startCandidates = [monthIndex(e.startDate), sprintStart].filter((v) => v != null);
  const endCandidates = [monthIndex(e.dueDate), sprintEnd].filter((v) => v != null);
  const start = startCandidates.length ? Math.min(...startCandidates) : null;
  const end = endCandidates.length ? Math.max(...endCandidates) : start;

  const status = computeStatus(e);
  const sp = epicSp(e);
  const lead = e.assignee && (e.assignee.firstName || e.assignee.lastName)
    ? `${e.assignee.firstName || ''} ${e.assignee.lastName || ''}`.trim()
    : '—';
  const sprintName = Array.isArray(e.sprints) && e.sprints[0]?.name
    ? e.sprints[0].name
    : (Array.isArray(e.jiraSprints) && e.jiraSprints[0]?.name) || e.key || '—';
  return {
    id: e._id || e.id,
    key: e.key,
    name: e.title || e.key,
    division,
    sp,
    status,
    progress: computeProgress(status),
    start,
    end,
    hasDates: start !== null,
    lead,
    sprint: sprintName,
    jiraUrl: e.jiraUrl,
    desc: e.description || '',
  };
};

const getDivisionMeta = (divisions, key) => {
  return divisions.find((d) => d.key === key)
    || { key, name: 'Transverse', color: '#8A8A8A', tint: 'rgba(138,138,138,0.10)', border: 'rgba(138,138,138,0.40)' };
};

const defaultBuilderState = () => ({
  streams: [
    { id: 's_cadrage', name: 'Cadrage',           type: 'custom', color: '#B8941F' },
    { id: 's_tech',    name: 'Technique & Dette', type: 'custom', color: '#3A3A3A' },
  ],
  topics: [],
});

const loadBuilderState = () => {
  try {
    const raw = localStorage.getItem(BUILDER_STORAGE_KEY);
    if (!raw) return defaultBuilderState();
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.streams) && Array.isArray(parsed.topics)) return parsed;
  } catch (e) { /* noop */ }
  return defaultBuilderState();
};

const Roadmap = () => {
  useTranslation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rawEpics, setRawEpics] = useState([]);
  const [view, setView] = useState('roadmap');
  const [division, setDivision] = useState('all');
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);

  const [builder, setBuilder] = useState(loadBuilderState);
  const [bHover, setBHover] = useState(null);
  const [editor, setEditor] = useState(null);
  const [addingStream, setAddingStream] = useState(false);
  const [newStreamName, setNewStreamName] = useState('');
  const dragRef = useRef(null);
  const lastDragEnd = useRef(0);                        // horodatage de fin de drag/resize (anti click fantôme)
  const [dragId, setDragId] = useState(null);          // sujet en cours de drag/resize
  const [dragTarget, setDragTarget] = useState(null);  // stream survolé pendant le drag

  // Stream de capacité équipe (dispo par sprint) + édition des congés
  const [capacityStream, setCapacityStream] = useState([]);
  const [showAvailability, setShowAvailability] = useState(false);
  const [availabilityTeam, setAvailabilityTeam] = useState([]);
  const [availabilityMemberId, setAvailabilityMemberId] = useState('');

  const openAvailability = useCallback((memberId = '') => {
    setAvailabilityMemberId(memberId || '');
    setShowAvailability(true);
  }, []);
  const [capacityExpanded, setCapacityExpanded] = useState(false);
  const [absences, setAbsences] = useState([]);
  // Fenêtre temporelle : nombre de mois affichés (3 = 1 trim., 6 = 2 trim., 12 = année)
  // + mois de début, déplaçable par trimestre via les flèches.
  const [viewMonths, setViewMonths] = useState(12);
  const [viewStart, setViewStart] = useState(0);

  const setSpan = (months) => {
    setViewMonths(months);
    setViewStart((prev) => {
      const snapped = Math.round(prev / 3) * 3; // calage sur un trimestre
      return Math.max(0, Math.min(TOTAL_MONTHS - months, snapped));
    });
  };
  const moveWindow = (deltaQuarters) => {
    setViewStart((prev) => Math.max(0, Math.min(TOTAL_MONTHS - viewMonths, prev + deltaQuarters * 3)));
  };
  const canLeft = viewStart > 0;
  const canRight = viewStart + viewMonths < TOTAL_MONTHS;

  // Durées T-shirt configurables (persistées)
  const [sizes, setSizes] = useState(loadSizes);
  const [showSizeConfig, setShowSizeConfig] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(SIZES_STORAGE_KEY, JSON.stringify(sizes)); } catch (e) { /* noop */ }
  }, [sizes]);

  // Fenêtre temporelle affichée : toujours mappée sur la même largeur (TIMELINE_WIDTH).
  // En vue trimestre, les 3 mois remplissent toute la largeur (mois plus larges).
  const viewWindow = { start: viewStart, months: viewMonths };
  const pxPerMonth = TIMELINE_WIDTH / viewMonths;
  const monthToPx = useCallback(
    (monthFloat) => (monthFloat - viewWindow.start) * pxPerMonth,
    [viewWindow.start, pxPerMonth]
  );
  const dateToPx = useCallback((date) => monthToPx(monthFloatOf(date)), [monthToPx]);
  const clampPx = (x) => Math.max(0, Math.min(TIMELINE_WIDTH, x));
  const todayPx = TODAY_MONTH_INDEX >= 0 ? monthToPx(TODAY_MONTH_INDEX) : -1;
  const todayInView = todayPx >= 0 && todayPx <= TIMELINE_WIDTH;

  // Positions (px) des débuts de sprint dans la fenêtre — filigrane discret sur le calendrier
  const sprintStarts = useMemo(
    () => capacityStream
      .map((c) => ({ id: c.sprintId, x: dateToPx(c.startDate), name: c.name }))
      .filter((m) => m.x >= 0 && m.x <= TIMELINE_WIDTH),
    [capacityStream, dateToPx]
  );
  const renderSprintStarts = () =>
    sprintStarts.map((m) => (
      <div key={m.id} className="roadmap-sprint-start" style={{ left: m.x }} title={`Début ${m.name}`} />
    ));

  // Marques des jours fériés MA visibles dans la fenêtre
  const holidayMarks = useMemo(
    () => holidays
      .map((h, i) => ({ id: h._id || `${h.date}_${i}`, x: dateToPx(h.date), name: h.name, date: h.date }))
      .filter((m) => m.x >= 0 && m.x <= TIMELINE_WIDTH),
    [holidays, dateToPx]
  );
  const renderHolidays = () =>
    holidayMarks.map((m) => (
      <div
        key={m.id}
        className="roadmap-holiday-line"
        style={{ left: m.x }}
        title={`Férié · ${m.name} · ${new Date(m.date).toLocaleDateString('fr-FR')}`}
      />
    ));

  // Regroupe les congés par membre : une seule ligne par personne (plusieurs segments)
  const absencesByMember = useMemo(() => {
    const map = new Map();
    absences.forEach((a) => {
      const id = (a.member && a.member._id) || 'unknown';
      if (!map.has(id)) map.set(id, { member: a.member || {}, periods: [] });
      map.get(id).periods.push(a);
    });
    return Array.from(map.values());
  }, [absences]);

  const loadCapacityStream = useCallback(async () => {
    try {
      const [streamRes, timeoffRes] = await Promise.all([getCapacityStream(), getTimeOff()]);
      setCapacityStream(streamRes.data || []);
      setAbsences(timeoffRes.data || []);
    } catch (e) {
      setCapacityStream([]);
      setAbsences([]);
    }
  }, []);

  useEffect(() => {
    loadCapacityStream();
    getTeamMembers().then(r => setAvailabilityTeam(r.data || [])).catch(() => setAvailabilityTeam([]));
  }, [loadCapacityStream]);

  // Jours fériés marocains sur tout l'horizon (affichage discret sur le tableau)
  const [holidays, setHolidays] = useState([]);
  useEffect(() => {
    getHolidaysByDateRange(`${BASE_YEAR}-01-01`, `${BASE_YEAR + HORIZON_YEARS - 1}-12-31`, 'MA')
      .then((r) => setHolidays((r.data || []).filter((h) => h.country === 'MA')))
      .catch(() => setHolidays([]));
  }, []);

  const [generatingSprints, setGeneratingSprints] = useState(false);
  const handleGenerateSprints = useCallback(async () => {
    setGeneratingSprints(true);
    try {
      const year = new Date().getFullYear();
      const res = await generateNextSprints({ untilDate: `${year}-12-31` });
      showToast({
        type: res.created > 0 ? 'success' : 'info',
        message: res.created > 0
          ? `${res.created} sprint(s) généré(s) (cadence 2 sem., ven → jeu)`
          : 'Les sprints jusqu’à fin d’année existent déjà',
      });
      loadCapacityStream();
    } catch (e) {
      showToast({ type: 'error', message: e.message || 'Erreur lors de la génération des sprints' });
    } finally {
      setGeneratingSprints(false);
    }
  }, [loadCapacityStream, showToast]);

  const loadEpics = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      // Uniquement les epics (avec SP enfants + sprints peuplés), pas les 2000+ tickets.
      const res = await epicService.getEpics({ issueType: 'Epic', limit: 500 });
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setRawEpics(list);
    } catch (err) {
      if (!silent) showToast({ type: 'error', message: err?.message || 'Erreur de chargement des epics' });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadEpics(); }, [loadEpics]);

  // Rafraîchissement automatique : au retour sur l'onglet + périodiquement,
  // pour refléter les rapports de sprints intégrés sans recharger la page.
  useEffect(() => {
    const refresh = () => { loadEpics({ silent: true }); loadCapacityStream(); };
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    const id = setInterval(refresh, 60000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(id); };
  }, [loadEpics, loadCapacityStream]);

  useEffect(() => {
    try { localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(builder)); } catch (e) { /* noop */ }
  }, [builder]);

  const divisions = useMemo(() => buildDivisions(rawEpics), [rawEpics]);

  // Entités connues (depuis les labels d'entité des epics) pour l'autocomplétion
  const entityOptions = useMemo(() => {
    const set = new Set();
    rawEpics.forEach((e) => (e.entityLabels || []).forEach((l) => {
      const n = (l && l.name) || l;
      if (n) set.add(n);
    }));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rawEpics]);

  const allEpics = useMemo(() => {
    return divisions.flatMap((d) => d.epics.map((e) => mapEpicForRoadmap(e, d)));
  }, [divisions]);

  const visibleDivisions = useMemo(() => {
    if (division === 'all') return divisions;
    return divisions.filter((d) => d.key === division);
  }, [divisions, division]);

  const visibleEpicsWithDates = useMemo(() => {
    return visibleDivisions.flatMap((d) => d.epics.map((e) => mapEpicForRoadmap(e, d)).filter((x) => x.hasDates));
  }, [visibleDivisions]);

  const stats = useMemo(() => {
    return {
      totalEpics: allEpics.length,
      totalSP: allEpics.reduce((s, e) => s + e.sp, 0),
      inProgress: allEpics.filter((e) => e.status === 'progress').length,
      atRisk: allEpics.filter((e) => e.status === 'risk').length,
    };
  }, [allEpics]);

  const selectedEpic = useMemo(() => allEpics.find((e) => e.id === selected) || null, [allEpics, selected]);

  // ---- Builder helpers ----
  const builderStreams = useMemo(() => {
    const divisionStreams = divisions.slice(0, 5).map((d) => ({
      id: `s_div_${d.key}`,
      name: d.name,
      type: 'division',
      divKey: d.key,
      color: d.color,
    }));
    const ids = new Set(divisionStreams.map((s) => s.id));
    const customs = builder.streams.filter((s) => !ids.has(s.id));
    return [...divisionStreams, ...customs];
  }, [divisions, builder.streams]);

  // Convertit une durée en mois vers la taille T-shirt la plus proche.
  const monthsToSize = useCallback((months) => {
    let best = SIZE_ORDER[0], bestDiff = Infinity;
    SIZE_ORDER.forEach((sz) => {
      const m = (sizes[sz] || 1) * MONTHS_PER_SPRINT;
      const diff = Math.abs(m - months);
      if (diff < bestDiff) { bestDiff = diff; best = sz; }
    });
    return best;
  }, [sizes]);

  // Déplacement d'un sujet : horizontal (mois) + vertical (changement de stream).
  const startDrag = useCallback((id, e) => {
    e.preventDefault();
    const topic = builder.topics.find((t) => t.id === id);
    if (!topic) return;
    const months = (sizes[topic.size] || 1) * MONTHS_PER_SPRINT;
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origStart: topic.start, moved: false, streamId: topic.streamId };
    setDragId(id);
    setDragTarget(topic.streamId);
    const onMove = (ev) => {
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
      const ns = Math.max(0, Math.min(TOTAL_MONTHS - months, dragRef.current.origStart + Math.round(dx / pxPerMonth)));
      // Stream survolé (drop vertical) via la lane sous le curseur
      let targetStream = dragRef.current.streamId;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const laneEl = el && el.closest('[data-stream-id]');
      if (laneEl) targetStream = laneEl.getAttribute('data-stream-id');
      dragRef.current.streamId = targetStream;
      setDragTarget(targetStream);
      setBuilder((prev) => ({
        ...prev,
        topics: prev.topics.map((tp) => (tp.id === id ? { ...tp, start: ns, streamId: targetStream } : tp)),
      }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const moved = dragRef.current?.moved;
      dragRef.current = null;
      lastDragEnd.current = Date.now();
      setDragId(null);
      setDragTarget(null);
      if (!moved) {
        const t = builder.topics.find((tp) => tp.id === id);
        if (t) setEditor({ mode: 'edit', draft: { ...t } });
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [builder.topics, pxPerMonth, sizes]);

  // Redimensionnement par poignée : bord droit = durée, bord gauche = début (fin fixe).
  const startResize = useCallback((id, edge, e) => {
    e.preventDefault();
    e.stopPropagation();
    const topic = builder.topics.find((t) => t.id === id);
    if (!topic) return;
    const origStart = topic.start;
    const origMonths = (sizes[topic.size] || 1) * MONTHS_PER_SPRINT;
    const origEnd = origStart + origMonths;
    const startX = e.clientX;
    setDragId(id);
    const onMove = (ev) => {
      const dMonths = (ev.clientX - startX) / pxPerMonth;
      if (edge === 'right') {
        const newMonths = Math.max(MONTHS_PER_SPRINT, Math.min(TOTAL_MONTHS - origStart, origMonths + dMonths));
        const size = monthsToSize(newMonths);
        setBuilder((prev) => ({ ...prev, topics: prev.topics.map((tp) => (tp.id === id ? { ...tp, size } : tp)) }));
      } else {
        const newStart = Math.max(0, Math.min(origEnd - MONTHS_PER_SPRINT, origStart + dMonths));
        const snappedStart = Math.round(newStart);
        const size = monthsToSize(origEnd - snappedStart);
        setBuilder((prev) => ({ ...prev, topics: prev.topics.map((tp) => (tp.id === id ? { ...tp, start: snappedStart, size } : tp)) }));
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      lastDragEnd.current = Date.now();
      setDragId(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [builder.topics, pxPerMonth, sizes, monthsToSize]);

  // Création instantanée : un clic pose un sujet (nom par défaut) et ouvre
  // aussitôt l'éditeur pour le renommer/ajuster. Le bloc reste même sans saisie.
  const openNewTopic = (streamId, start = 0) => {
    const sid = streamId || builderStreams[0]?.id;
    const st = builderStreams.find((s) => s.id === sid);
    const divKey = st?.divKey || (divisions[0]?.key) || 'autres';
    const id = `t_${Date.now()}`;
    const topic = { id, name: 'Nouveau sujet', divKey, entity: '', streamId: sid, size: 'M', start: Math.max(0, Math.min(TOTAL_MONTHS - 1, Math.round(start))) };
    setBuilder((prev) => ({ ...prev, topics: [...prev.topics, topic] }));
    setEditor({ mode: 'edit', draft: { ...topic } });
  };

  const setDraft = (patch) => setEditor((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));

  const saveTopic = () => {
    if (!editor) return;
    const d = editor.draft;
    if (!d.name.trim()) return;
    setBuilder((prev) => {
      let topics;
      if (d.id) {
        topics = prev.topics.map((t) => (t.id === d.id ? { ...t, ...d, name: d.name.trim() } : t));
      } else {
        topics = [...prev.topics, { ...d, id: `t_${Date.now()}`, name: d.name.trim() }];
      }
      return { ...prev, topics };
    });
    setEditor(null);
  };

  const deleteTopic = () => {
    if (!editor?.draft?.id) { setEditor(null); return; }
    const id = editor.draft.id;
    setBuilder((prev) => ({ ...prev, topics: prev.topics.filter((t) => t.id !== id) }));
    setEditor(null);
  };

  const addStream = () => {
    const name = (newStreamName || '').trim();
    if (!name) return;
    setBuilder((prev) => ({
      ...prev,
      streams: [...prev.streams, { id: `s_${Date.now()}`, name, type: 'custom', color: '#3A3A3A' }],
    }));
    setAddingStream(false);
    setNewStreamName('');
  };

  const removeStream = (id) => {
    setBuilder((prev) => ({
      ...prev,
      streams: prev.streams.filter((s) => s.id !== id),
      topics: prev.topics.filter((t) => t.streamId !== id),
    }));
  };

  // ---- Render values ----
  const tabs = [
    { id: 'roadmap', label: 'Roadmap' },
    { id: 'sp',      label: 'Story points' },
    { id: 'build',   label: 'Atelier' },
  ];

  const headerStats = view === 'build'
    ? [
        { value: builder.topics.length, label: 'Sujets' },
        { value: builder.topics.reduce((s, t) => s + (SIZE_WEIGHT[t.size] || 0), 0), label: 'Charge' },
        { value: builderStreams.length, label: 'Streams' },
        { value: builder.topics.filter((t) => /cadrage/i.test(builderStreams.find((s) => s.id === t.streamId)?.name || '')).length, label: 'À cadrer', gold: true },
      ]
    : [
        { value: stats.totalEpics, label: 'Epics' },
        { value: stats.totalSP,    label: 'Story points' },
        { value: stats.inProgress, label: 'En cours' },
        { value: stats.atRisk,     label: 'À risque', gold: true },
      ];

  const pageTitle = view === 'build' ? 'Atelier' : view === 'sp' ? 'Story points' : 'Roadmap';
  const pageEyebrow = view === 'build'
    ? 'Atelier · Construction de la feuille de route'
    : view === 'sp'
      ? 'Coût par epic · Story points rattachés'
      : 'Feuille de route · Équipe Produit';

  // ---- SP histogram data ----
  const spEpics = useMemo(() => {
    return [...visibleEpicsWithDates, ...visibleDivisions.flatMap((d) => d.epics.map((e) => mapEpicForRoadmap(e, d)).filter((x) => !x.hasDates))]
      .filter((e) => e.sp > 0)
      .sort((a, b) => b.sp - a.sp);
  }, [visibleEpicsWithDates, visibleDivisions]);

  const niceMaxSp = useMemo(() => {
    const m = spEpics.reduce((acc, x) => Math.max(acc, x.sp), 0) || 1;
    return Math.max(10, Math.ceil(m / 10) * 10);
  }, [spEpics]);

  const spSummary = {
    total: spEpics.reduce((s, x) => s + x.sp, 0),
    topSp: spEpics[0]?.sp || 0,
    topName: spEpics[0]?.name || '—',
    avg: spEpics.length ? Math.round(spEpics.reduce((s, x) => s + x.sp, 0) / spEpics.length) : 0,
  };

  // ---- Builder lanes layout ----
  const builderLanes = useMemo(() => {
    return builderStreams.map((stream) => {
      const items = builder.topics
        .filter((t) => t.streamId === stream.id)
        .slice()
        .sort((a, b) => a.start - b.start || ((sizes[b.size] || 0) - (sizes[a.size] || 0)));
      const rows = [];
      items.forEach((t) => {
        const tEnd = t.start + (sizes[t.size] || 1) * MONTHS_PER_SPRINT;
        let placed = false;
        for (let ri = 0; ri < rows.length; ri++) {
          if (rows[ri].end <= t.start) { rows[ri].end = tEnd; t._row = ri; placed = true; break; }
        }
        if (!placed) { t._row = rows.length; rows.push({ end: tEnd }); }
      });
      return { stream, items, rowCount: Math.max(1, rows.length) };
    });
  }, [builderStreams, builder.topics, sizes]);

  if (loading) {
    return (
      <div className="roadmap-page__loading">
        <Spinner />
      </div>
    );
  }

  // ===== Render =====
  return (
    <div className="roadmap-page">
      <div className="roadmap-chrome">
        <div className="roadmap-chrome__brand">
          <span className="roadmap-chrome__title">POTool</span>
          <Tabs
            tabs={tabs}
            activeTab={view}
            onTabChange={(v) => { setView(v); setHovered(null); }}
            variant="underline"
            size="sm"
          />
        </div>
        <div className="roadmap-chrome__meta">
          {(view === 'roadmap' || view === 'build') && (
            <>
              <div className="roadmap-scope">
                {[
                  { months: TOTAL_MONTHS, label: `${HORIZON_YEARS} ans` },
                  { months: 12, label: 'Année' },
                  { months: 6, label: '2 trim.' },
                  { months: 3, label: '1 trim.' },
                ].map((s) => (
                  <button
                    key={s.months}
                    type="button"
                    className={`roadmap-scope__btn ${viewMonths === s.months ? 'roadmap-scope__btn--active' : ''}`}
                    onClick={() => setSpan(s.months)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {viewMonths < TOTAL_MONTHS && (
                <div className="roadmap-scope-nav">
                  <button type="button" className="roadmap-scope-nav__btn" disabled={!canLeft} onClick={() => moveWindow(-1)} title="Période précédente">
                    <i className="bi bi-chevron-left" />
                  </button>
                  <span className="roadmap-scope-nav__label">
                    {monthShOf(viewStart)} {yearOfIndex(viewStart)} – {monthShOf(viewStart + viewMonths - 1)} {yearOfIndex(viewStart + viewMonths - 1)}
                  </span>
                  <button type="button" className="roadmap-scope-nav__btn" disabled={!canRight} onClick={() => moveWindow(1)} title="Période suivante">
                    <i className="bi bi-chevron-right" />
                  </button>
                </div>
              )}
            </>
          )}
          <button
            type="button"
            className="roadmap-refresh"
            onClick={() => { loadEpics({ silent: true }); loadCapacityStream(); showToast({ type: 'success', message: 'Roadmap actualisée' }); }}
            title="Actualiser la roadmap"
          >
            <i className="bi bi-arrow-clockwise" /> Actualiser
          </button>
          <span className="roadmap-chrome__year">{BASE_YEAR} – {BASE_YEAR + HORIZON_YEARS - 1}</span>
        </div>
      </div>

      <div className="roadmap-editorial">
        <div>
          <div className="roadmap-editorial__eyebrow">{pageEyebrow}</div>
          <h1 className="roadmap-editorial__title">{pageTitle}</h1>
        </div>
        <div className="roadmap-editorial__stats">
          {headerStats.map((s, i) => (
            <div
              key={s.label}
              className="roadmap-editorial__cell"
              style={{ borderRight: i === headerStats.length - 1 ? 'none' : '1px solid #E5E7EB' }}
            >
              <div
                className="roadmap-editorial__cell-value"
                style={{ color: s.gold ? '#B8941F' : '#000' }}
              >
                {s.value}
              </div>
              <div className="roadmap-editorial__cell-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {view !== 'build' && (
        <div className="roadmap-filterbar">
          <div className="roadmap-filterbar__chips">
            <span className="roadmap-filterbar__label">Division</span>
            <button
              type="button"
              className={`roadmap-chip ${division === 'all' ? 'roadmap-chip--active' : ''}`}
              onClick={() => setDivision('all')}
            >
              Toutes
            </button>
            {divisions.map((d) => (
              <button
                key={d.key}
                type="button"
                className={`roadmap-chip ${division === d.key ? 'roadmap-chip--active' : ''}`}
                onClick={() => setDivision(d.key)}
              >
                <span className="roadmap-chip__dot" style={{ background: d.color }} />
                {d.name}
              </button>
            ))}
          </div>
          <div className="roadmap-filterbar__legend">
            {Object.entries(STATUS_META).map(([k, m]) => (
              <span key={k} className="roadmap-legend-item">
                <span className="roadmap-legend-item__dot" style={{ background: m.color }} />
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {view === 'build' && (
        <div className="roadmap-buildbar">
          <div className="roadmap-buildbar__left">
            <Button variant="primary" size="sm" onClick={() => openNewTopic(builderStreams[0]?.id, viewWindow.start)}>
              + Nouveau sujet
            </Button>
            <Button variant="secondary" size="sm" loading={generatingSprints} onClick={handleGenerateSprints}>
              <i className="bi bi-calendar2-plus" /> Générer les prochains sprints
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowSizeConfig(true)}>
              <i className="bi bi-rulers" /> Tailles T-shirt
            </Button>
            <span className="roadmap-buildbar__hint">
              Cliquez une ligne pour créer · glissez un sujet (même entre streams) · poignées ↔ pour redimensionner
            </span>
          </div>
          <div className="roadmap-buildbar__sizes">
            <span className="roadmap-filterbar__label">T-shirt</span>
            {SIZE_ORDER.map((sz) => (
              <span key={sz} className="roadmap-size-legend">
                <span className="roadmap-size-legend__big">{sz}</span>
                <span className="roadmap-size-legend__sub">{sizes[sz]} sprint(s)</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {view === 'roadmap' && (
        <div className="roadmap-board__wrap">
          <div className="roadmap-board">
            <RoadmapTimelineHeader viewWindow={viewWindow} pxPerMonth={pxPerMonth} todayInView={todayInView} todayPx={todayPx} sprintStarts={sprintStarts} holidayMarks={holidayMarks} />
            {visibleDivisions.map((d) => {
              const epics = d.epics.map((e) => mapEpicForRoadmap(e, d)).filter((x) => x.hasDates);
              return (
                <React.Fragment key={d.key}>
                  <div className="roadmap-board__row">
                    <div className="roadmap-board__label-cell roadmap-board__label-cell--division" onClick={() => setDivision(division === d.key ? 'all' : d.key)}>
                      <span className="roadmap-board__swatch" style={{ background: d.color }} />
                      <span className="roadmap-board__division-name">{d.name}</span>
                      <span className="roadmap-board__division-meta">{d.epics.length} epics · {d.epics.reduce((s, e) => s + epicSp(e), 0)} SP</span>
                    </div>
                    <div className="roadmap-board__band" style={{ width: TIMELINE_WIDTH, background: d.tint }}>
                      {renderHolidays()}
                      {todayInView && <div className="roadmap-board__today-line" style={{ left: todayPx }} />}
                    </div>
                  </div>
                  {epics.map((e) => (
                    <EpicRow
                      key={e.id}
                      epic={e}
                      division={d}
                      hovered={hovered === e.id}
                      selected={selected === e.id}
                      onHover={setHovered}
                      onSelect={setSelected}
                      monthToPx={monthToPx}
                      todayInView={todayInView}
                      todayPx={todayPx}
                      holidayMarks={holidayMarks}
                    />
                  ))}
                  {epics.length === 0 && (
                    <div className="roadmap-board__row">
                      <div className="roadmap-board__label-cell roadmap-board__label-cell--empty">
                        Aucun epic avec dates dans cette division
                      </div>
                      <div style={{ width: TIMELINE_WIDTH, height: 52, borderBottom: '1px solid #F4F4F4' }} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            {visibleDivisions.length === 0 && (
              <div className="roadmap-board__empty">Aucun epic à afficher</div>
            )}
          </div>
        </div>
      )}

      {view === 'sp' && (
        <div className="roadmap-sp__wrap">
          <div className="roadmap-sp">
            <div className="roadmap-sp__summary">
              <div className="roadmap-sp__summary-cell">
                <div className="roadmap-sp__summary-label">Total story points</div>
                <div className="roadmap-sp__summary-value">{spSummary.total}</div>
              </div>
              <div className="roadmap-sp__summary-cell roadmap-sp__summary-cell--wide">
                <div className="roadmap-sp__summary-label">Epic le plus coûteux</div>
                <div className="roadmap-sp__summary-top">
                  <span className="roadmap-sp__summary-value">{spSummary.topSp}</span>
                  <span className="roadmap-sp__summary-topname">{spSummary.topName}</span>
                </div>
              </div>
              <div className="roadmap-sp__summary-cell">
                <div className="roadmap-sp__summary-label">Moyenne / epic</div>
                <div className="roadmap-sp__summary-value">{spSummary.avg}</div>
              </div>
            </div>

            <div className="roadmap-sp__colheader">
              <span>Classement · Epic</span>
              <span>Story points rattachés</span>
              <span style={{ textAlign: 'right' }}>Total</span>
            </div>

            <div className="roadmap-sp__bars">
              {spEpics.map((e, i) => {
                const hov = hovered === e.id;
                const sel = selected === e.id;
                return (
                  <div
                    key={e.id}
                    className={`roadmap-sp__row ${hov || sel ? 'roadmap-sp__row--active' : ''}`}
                    onClick={() => setSelected(e.id)}
                    onMouseEnter={() => setHovered(e.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <div className="roadmap-sp__name">
                      <span className="roadmap-sp__rank">{String(i + 1).padStart(2, '0')}</span>
                      <span className="roadmap-sp__dot" style={{ background: e.division.color }} />
                      <div className="roadmap-sp__name-text">
                        <div className="roadmap-sp__name-main">{e.name}</div>
                        <div className="roadmap-sp__name-sub">{e.division.name}</div>
                      </div>
                    </div>
                    <div className="roadmap-sp__bar-cell">
                      <div
                        className="roadmap-sp__bar"
                        style={{
                          width: `${(e.sp / niceMaxSp) * 100}%`,
                          background: e.division.tint,
                          border: `1px solid ${e.division.border}`,
                        }}
                      >
                        <div
                          className="roadmap-sp__bar-fill"
                          style={{ width: `${e.progress * 100}%`, background: e.division.color }}
                        />
                      </div>
                    </div>
                    <div className="roadmap-sp__total">
                      <div className="roadmap-sp__total-num">{e.sp}</div>
                      <div className="roadmap-sp__total-sub">
                        {Math.round(e.sp * e.progress) > 0 ? `${Math.round(e.sp * e.progress)} livrés` : 'à démarrer'}
                      </div>
                    </div>
                  </div>
                );
              })}
              {spEpics.length === 0 && <div className="roadmap-board__empty">Aucun epic avec story points</div>}
            </div>

            <div className="roadmap-sp__axis">
              <div className="roadmap-sp__axis-grid">
                <div />
                <div className="roadmap-sp__axis-ticks">
                  {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                    <span key={f}>{Math.round(niceMaxSp * f)}</span>
                  ))}
                </div>
                <div />
              </div>
              <div className="roadmap-sp__axis-legend">
                <span className="roadmap-sp__axis-legend-item">
                  <span className="roadmap-sp__axis-swatch roadmap-sp__axis-swatch--solid" />
                  SP livrés
                </span>
                <span className="roadmap-sp__axis-legend-item">
                  <span className="roadmap-sp__axis-swatch roadmap-sp__axis-swatch--outline" />
                  SP restants
                </span>
                <span className="roadmap-sp__axis-hint">Couleur = division · trié du plus coûteux au moins coûteux</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'build' && (
        <>
        <div className="roadmap-board__wrap">
          <div className="roadmap-board">
            <RoadmapTimelineHeader labelTitle="Stream · Sujet" viewWindow={viewWindow} pxPerMonth={pxPerMonth} todayInView={todayInView} todayPx={todayPx} sprintStarts={sprintStarts} holidayMarks={holidayMarks} />
            {builderLanes.map(({ stream, items, rowCount }) => {
              const blockH = 34, gap = 8, padV = 11;
              const laneH = padV * 2 + rowCount * blockH + (rowCount - 1) * gap;
              return (
                <div className="roadmap-board__row" key={stream.id}>
                  <div className="roadmap-board__label-cell roadmap-board__label-cell--stream" style={{ height: laneH }}>
                    <span
                      className="roadmap-board__swatch"
                      style={{ background: stream.color, borderRadius: stream.type === 'custom' ? '9999px' : '2px' }}
                    />
                    <div className="roadmap-board__stream-info">
                      <div className="roadmap-board__stream-name">{stream.name}</div>
                      <div className="roadmap-board__stream-meta">{items.length} {items.length > 1 ? 'sujets' : 'sujet'}</div>
                    </div>
                    <button
                      type="button"
                      className="roadmap-board__icon-btn"
                      onClick={(e) => { e.stopPropagation(); openNewTopic(stream.id, viewWindow.start); }}
                      title="Ajouter un sujet"
                    >+</button>
                    {stream.type === 'custom' && (
                      <button
                        type="button"
                        className="roadmap-board__icon-btn roadmap-board__icon-btn--ghost"
                        onClick={(e) => { e.stopPropagation(); removeStream(stream.id); }}
                        title="Supprimer le stream"
                      >×</button>
                    )}
                  </div>
                  <div
                    className={`roadmap-board__band roadmap-board__band--track ${dragId && dragTarget === stream.id ? 'roadmap-board__band--drop-target' : ''}`}
                    data-stream-id={stream.id}
                    style={{ width: TIMELINE_WIDTH, height: laneH }}
                    onClick={(e) => {
                      // Ignore le clic fantôme émis juste après un drag/resize
                      if (Date.now() - lastDragEnd.current < 300) return;
                      const r = e.currentTarget.getBoundingClientRect();
                      const m = Math.max(0, Math.min(TOTAL_MONTHS - 1, viewWindow.start + Math.floor((e.clientX - r.left) / pxPerMonth)));
                      openNewTopic(stream.id, m);
                    }}
                  >
                    {renderSprintStarts()}
                    {renderHolidays()}
                    {todayInView && <div className="roadmap-board__today-line" style={{ left: todayPx, opacity: 0.6 }} />}
                    {items.length === 0 && (
                      <span className="roadmap-board__empty-hint">Cliquez pour ajouter un sujet</span>
                    )}
                    {items.map((tp) => {
                      const dm = getDivisionMeta(divisions, tp.divKey);
                      const months = (sizes[tp.size] || 1) * MONTHS_PER_SPRINT;
                      const rawLeft = monthToPx(tp.start);
                      const rawRight = monthToPx(tp.start + months);
                      if (rawRight <= 0 || rawLeft >= TIMELINE_WIDTH) return null;
                      const left = Math.max(0, rawLeft) + 5;
                      const width = Math.max(10, Math.min(TIMELINE_WIDTH, rawRight) - Math.max(0, rawLeft) - 10);
                      const topY = padV + (tp._row || 0) * (blockH + gap);
                      const hov = bHover === tp.id;
                      return (
                        <div
                          key={tp.id}
                          className={`roadmap-topic ${hov ? 'roadmap-topic--hover' : ''} ${dragId === tp.id ? 'roadmap-topic--dragging' : ''}`}
                          style={{
                            left, width, top: topY, height: blockH,
                            borderLeft: `3px solid ${dm.color}`,
                            borderColor: dm.border,
                          }}
                          onMouseDown={(e) => startDrag(tp.id, e)}
                          onClick={(e) => e.stopPropagation()}
                          onMouseEnter={() => setBHover(tp.id)}
                          onMouseLeave={() => setBHover(null)}
                          title={`${tp.name}${tp.entity ? ` · ${tp.entity}` : ''} · ${tp.size} — glisser pour déplacer, poignées pour redimensionner`}
                        >
                          <span
                            className="roadmap-topic__resize roadmap-topic__resize--left"
                            onMouseDown={(e) => startResize(tp.id, 'left', e)}
                            title="Redimensionner (début)"
                          />
                          <span className="roadmap-topic__name">{tp.name}</span>
                          {tp.entity && <span className="roadmap-topic__entity">{tp.entity}</span>}
                          <span
                            className="roadmap-topic__badge"
                            style={{ color: dm.color, background: dm.tint, borderColor: dm.border }}
                          >{tp.size}</span>
                          <span
                            className="roadmap-topic__resize roadmap-topic__resize--right"
                            onMouseDown={(e) => startResize(tp.id, 'right', e)}
                            title="Redimensionner (durée)"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="roadmap-board__row roadmap-board__row--add">
              <div className="roadmap-board__label-cell roadmap-board__label-cell--add">
                {addingStream ? (
                  <div className="roadmap-board__add-stream">
                    <input
                      value={newStreamName}
                      onChange={(e) => setNewStreamName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addStream();
                        if (e.key === 'Escape') { setAddingStream(false); setNewStreamName(''); }
                      }}
                      placeholder="Nom du stream"
                      autoFocus
                    />
                    <Button variant="primary" size="sm" onClick={addStream}>OK</Button>
                  </div>
                ) : (
                  <button type="button" className="roadmap-board__add-link" onClick={() => setAddingStream(true)}>
                    + Ajouter un stream
                  </button>
                )}
              </div>
              <div style={{ width: TIMELINE_WIDTH, height: 52, background: '#FAFAFA', borderBottom: '1px solid #ECECEC' }} />
            </div>

            {/* Lane de capacité équipe */}
            <div className="roadmap-board__row roadmap-board__row--capacity">
              <div className="roadmap-board__label-cell roadmap-board__label-cell--capacity">
                <button
                  type="button"
                  className="roadmap-capacity-chevron"
                  onClick={() => setCapacityExpanded(v => !v)}
                  title={capacityExpanded ? 'Replier' : 'Déplier les absences'}
                >
                  <i className={`bi ${capacityExpanded ? 'bi-chevron-down' : 'bi-chevron-right'}`} />
                </button>
                <span className="roadmap-board__swatch" style={{ background: '#5B6B7A' }} />
                <span className="roadmap-board__division-name">Capacité équipe</span>
              </div>
              <div
                className="roadmap-board__band roadmap-board__band--capacity"
                style={{ width: TIMELINE_WIDTH }}
                onClick={() => openAvailability()}
                title="Cliquez pour saisir les congés de l'équipe"
              >
                {todayInView && <div className="roadmap-board__today-line" style={{ left: todayPx }} />}
                {capacityStream.map((c) => {
                  const rawLeft = dateToPx(c.startDate);
                  const rawRight = dateToPx(c.endDate);
                  if (rawRight <= 0 || rawLeft >= TIMELINE_WIDTH) return null;
                  const left = clampPx(rawLeft);
                  const width = clampPx(rawRight) - left;
                  if (width <= 0) return null;
                  return (
                    <div
                      key={c.sprintId}
                      className="roadmap-capacity-seg"
                      style={{ left: left + 2, width: Math.max(width - 4, 6), background: availabilityColor(c.availabilityPercent) }}
                      title={`${c.name}\n${c.availabilityPercent}% dispo · ${c.totalDaysOff} j de congés`}
                    >
                      <span className="roadmap-capacity-seg__val">{c.availabilityPercent}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Détail des absences (déplié) — une ligne par personne, plusieurs segments */}
            {capacityExpanded && (
              absencesByMember.length === 0 ? (
                <div className="roadmap-board__row roadmap-capacity-abs-row">
                  <div className="roadmap-board__label-cell roadmap-capacity-abs-empty">Aucune absence saisie</div>
                  <div className="roadmap-board__band roadmap-capacity-abs-band" style={{ width: TIMELINE_WIDTH }} />
                </div>
              ) : (
                absencesByMember.map(({ member: m, periods }) => {
                  const segments = periods
                    .map((a) => {
                      const rawLeft = dateToPx(a.startDate);
                      const rawRight = dateToPx(a.endDate);
                      if (rawRight <= 0 || rawLeft >= TIMELINE_WIDTH) return null;
                      const left = clampPx(rawLeft);
                      const width = clampPx(rawRight) - left;
                      return width > 0 ? { ...a, left, width } : null;
                    })
                    .filter(Boolean);
                  if (segments.length === 0) return null;
                  return (
                    <div className="roadmap-board__row roadmap-capacity-abs-row" key={m._id || (m.firstName + m.lastName)}>
                      <div
                        className="roadmap-board__label-cell roadmap-capacity-abs-label roadmap-capacity-abs-label--clickable"
                        onDoubleClick={() => openAvailability(m._id)}
                        title="Double-cliquez pour ajuster les congés de ce membre"
                      >
                        <img className="roadmap-capacity-avatar" src={memberAvatarUrl(m)} alt="" />
                        <span className="roadmap-capacity-abs-name">{m.firstName} {m.lastName}</span>
                      </div>
                      <div className="roadmap-board__band roadmap-capacity-abs-band" style={{ width: TIMELINE_WIDTH }}>
                        {segments.map((seg, idx) => {
                          const period = `${new Date(seg.startDate).toLocaleDateString('fr-FR')} → ${new Date(seg.endDate).toLocaleDateString('fr-FR')}`;
                          return (
                            <div
                              key={seg._id || idx}
                              className="roadmap-capacity-abs-line"
                              style={{ left: seg.left, width: Math.max(seg.width, 10) }}
                              title={`${m.firstName} ${m.lastName} · ${period}${seg.reason ? ' · ' + seg.reason : ''}`}
                            >
                              {idx === 0 && <img className="roadmap-capacity-abs-avatar" src={memberAvatarUrl(m)} alt="" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>
        {viewMonths < TOTAL_MONTHS && (
          <MonthScrollbar viewStart={viewStart} viewMonths={viewMonths} onChange={setViewStart} />
        )}
        </>
      )}

      {/* Side panel: epic detail */}
      <div
        className={`roadmap-scrim ${selectedEpic ? 'roadmap-scrim--open' : ''}`}
        onClick={() => setSelected(null)}
      />
      <aside className={`roadmap-panel ${selectedEpic ? 'roadmap-panel--open' : ''}`}>
        {selectedEpic && (
          <EpicPanel epic={selectedEpic} onClose={() => setSelected(null)} />
        )}
      </aside>

      {/* Editor panel */}
      <div
        className={`roadmap-scrim ${editor ? 'roadmap-scrim--open' : ''}`}
        onClick={() => setEditor(null)}
      />
      <aside className={`roadmap-panel ${editor ? 'roadmap-panel--open' : ''}`}>
        {editor && (
          <BuilderEditor
            editor={editor}
            divisions={divisions}
            streams={builderStreams}
            sizes={sizes}
            entityOptions={entityOptions}
            setDraft={setDraft}
            onSave={saveTopic}
            onDelete={deleteTopic}
            onClose={() => setEditor(null)}
          />
        )}
      </aside>

      <TeamAvailabilityModal
        open={showAvailability}
        onClose={() => setShowAvailability(false)}
        teamMembers={availabilityTeam}
        onChanged={loadCapacityStream}
        initialMemberId={availabilityMemberId}
      />

      <SizeConfigModal
        open={showSizeConfig}
        onClose={() => setShowSizeConfig(false)}
        sizes={sizes}
        onSave={setSizes}
      />
    </div>
  );
};

// ===== Sub-components =====

// Barre de défilement des mois : un curseur (fenêtre visible) glissable au mois
// près sur tout l'horizon pluriannuel, + boutons ‹ › pour avancer d'un mois.
const MonthScrollbar = ({ viewStart, viewMonths, onChange }) => {
  const trackRef = useRef(null);
  const total = TOTAL_MONTHS;
  const maxStart = total - viewMonths;
  const endMonth = viewStart + viewMonths - 1;

  const startThumbDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = trackRef.current.getBoundingClientRect();
    const monthPx = rect.width / total;
    const origStart = viewStart;
    const startX = e.clientX;
    const move = (ev) => {
      const dMonths = (ev.clientX - startX) / monthPx;
      onChange(Math.max(0, Math.min(maxStart, Math.round(origStart + dMonths))));
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const onTrackClick = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const clickMonth = ((e.clientX - rect.left) / rect.width) * total;
    onChange(Math.max(0, Math.min(maxStart, Math.round(clickMonth - viewMonths / 2))));
  };

  return (
    <div className="roadmap-monthscroll">
      <button
        type="button"
        className="roadmap-monthscroll__step"
        disabled={viewStart <= 0}
        onClick={() => onChange(Math.max(0, viewStart - 1))}
        title="Mois précédent"
      >‹</button>
      <div className="roadmap-monthscroll__track" ref={trackRef} onMouseDown={onTrackClick}>
        {Array.from({ length: HORIZON_YEARS }, (_, y) => (
          <span
            key={y}
            className="roadmap-monthscroll__year"
            style={{ left: `${((y * 12) / total) * 100}%`, width: `${(12 / total) * 100}%` }}
          >
            {BASE_YEAR + y}
          </span>
        ))}
        <div
          className="roadmap-monthscroll__thumb"
          style={{ left: `${(viewStart / total) * 100}%`, width: `${(viewMonths / total) * 100}%` }}
          onMouseDown={startThumbDrag}
          title="Glissez pour faire défiler les mois"
        >
          <span className="roadmap-monthscroll__thumb-label">
            {monthShOf(viewStart)} {yearOfIndex(viewStart)} – {monthShOf(endMonth)} {yearOfIndex(endMonth)}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="roadmap-monthscroll__step"
        disabled={viewStart >= maxStart}
        onClick={() => onChange(Math.min(maxStart, viewStart + 1))}
        title="Mois suivant"
      >›</button>
    </div>
  );
};

const RoadmapTimelineHeader = ({ labelTitle = 'Division · Epic', viewWindow, pxPerMonth, todayInView, todayPx, sprintStarts = [], holidayMarks = [] }) => {
  const months = Array.from({ length: viewWindow.months }, (_, i) => viewWindow.start + i);
  // Découpe les trimestres présents dans la fenêtre
  const quarters = [];
  for (let i = 0; i < viewWindow.months;) {
    const m = viewWindow.start + i;
    const span = Math.min(3 - (m % 3), viewWindow.months - i);
    quarters.push({ qNum: Math.floor((m % 12) / 3) + 1, year: yearOfIndex(m), span });
    i += span;
  }
  return (
    <div className="roadmap-board__header">
      <div className="roadmap-board__label-cell roadmap-board__label-cell--header">
        <span className="roadmap-board__label-title">{labelTitle}</span>
      </div>
      <div className="roadmap-board__timeline-head" style={{ width: TIMELINE_WIDTH }}>
        <div className="roadmap-board__quarters">
          {quarters.map((q, idx) => (
            <div key={idx} className="roadmap-board__quarter" style={{ width: q.span * pxPerMonth }}>
              <span>T{q.qNum} {q.year}</span>
            </div>
          ))}
        </div>
        <div className="roadmap-board__months">
          {months.map((m) => (
            <div key={m} className="roadmap-board__month" style={{ width: pxPerMonth }}>
              <span>{monthCapOf(m)}{(m % 12) === 0 ? ` ’${String(yearOfIndex(m)).slice(2)}` : ''}</span>
            </div>
          ))}
        </div>
        {sprintStarts.map((m) => (
          <div key={m.id} className="roadmap-sprint-start roadmap-sprint-start--head" style={{ left: m.x }} title={`Début ${m.name}`}>
            <span className="roadmap-sprint-start__name">{m.name}</span>
          </div>
        ))}
        {holidayMarks.map((m) => (
          <div
            key={`h_${m.id}`}
            className="roadmap-holiday-mark"
            style={{ left: m.x }}
            title={`Férié · ${m.name} · ${new Date(m.date).toLocaleDateString('fr-FR')}`}
          >
            <span className="roadmap-holiday-mark__dot" />
          </div>
        ))}
        {todayInView && (
          <>
            <div className="roadmap-board__today-line" style={{ left: todayPx }} />
            <div className="roadmap-board__today-label" style={{ left: todayPx + 4 }}>Auj.</div>
          </>
        )}
      </div>
    </div>
  );
};

const EpicRow = ({ epic, division, hovered, selected, onHover, onSelect, monthToPx, todayInView, todayPx, holidayMarks = [] }) => {
  const st = STATUS_META[epic.status];
  const start = Math.max(0, Math.min(TOTAL_MONTHS - 1, epic.start || 0));
  const end = Math.max(start, Math.min(TOTAL_MONTHS - 1, epic.end ?? start));
  const rawLeft = monthToPx(start);
  const rawRight = monthToPx(end + 1);
  // Hors de la fenêtre affichée → on masque la ligne
  if (rawRight <= 0 || rawLeft >= TIMELINE_WIDTH) return null;
  const left = Math.max(0, rawLeft) + 2;
  const width = Math.max(6, Math.min(TIMELINE_WIDTH, rawRight) - Math.max(0, rawLeft) - 4);
  const planned = epic.status === 'planned';
  const risk = epic.status === 'risk';

  return (
    <div className="roadmap-board__row">
      <div className="roadmap-board__label-cell roadmap-board__label-cell--epic">
        <div className="roadmap-board__epic-name">{epic.name}</div>
        <div className="roadmap-board__epic-meta">
          <span className="roadmap-board__epic-dot" style={{ background: st.color }} />
          <span className="roadmap-board__epic-status" style={{ color: st.color }}>{st.label}</span>
          <span className="roadmap-board__epic-sep">·</span>
          <span className="roadmap-board__epic-sp">{epic.sp} SP</span>
        </div>
      </div>
      <div className="roadmap-board__band roadmap-board__band--epic" style={{ width: TIMELINE_WIDTH }}>
        {holidayMarks.map((m) => (
          <div key={m.id} className="roadmap-holiday-line" style={{ left: m.x }} title={`Férié · ${m.name}`} />
        ))}
        {todayInView && <div className="roadmap-board__today-line" style={{ left: todayPx, opacity: 0.45 }} />}
        <div
          className={`roadmap-bar ${hovered || selected ? 'roadmap-bar--active' : ''}`}
          style={{
            left, width,
            background: planned ? '#FFFFFF' : division.tint,
            border: planned ? `1px dashed ${division.border}` : `1px solid ${division.border}`,
            borderLeft: risk ? '3px solid #B8941F' : (planned ? `1px dashed ${division.border}` : `1px solid ${division.border}`),
          }}
          onClick={() => onSelect(epic.id)}
          onMouseEnter={() => onHover(epic.id)}
          onMouseLeave={() => onHover(null)}
        >
          <div
            className="roadmap-bar__fill"
            style={{
              width: planned ? 0 : Math.max(6, (width - 2) * epic.progress),
              background: division.color,
              opacity: epic.status === 'done' ? 1 : 0.92,
            }}
          />
          <span className="roadmap-bar__chip">{epic.sp} SP</span>
        </div>
        {hovered && (
          <div className="roadmap-bar__tip" style={{ left }}>
            <div className="roadmap-bar__tip-title">{epic.name}</div>
            <div className="roadmap-bar__tip-meta">
              {division.name} · {st.label} · {monthShOf(start)} {yearOfIndex(start)} → {monthShOf(end)} {yearOfIndex(end)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const EpicPanel = ({ epic, onClose }) => {
  const st = STATUS_META[epic.status];
  const start = Math.max(0, Math.min(TOTAL_MONTHS - 1, epic.start || 0));
  const end = Math.max(start, Math.min(TOTAL_MONTHS - 1, epic.end ?? start));
  const period = `${monthShOf(start)} ${yearOfIndex(start)} → ${monthShOf(end)} ${yearOfIndex(end)}`;

  return (
    <div className="roadmap-panel__inner">
      <div className="roadmap-panel__head">
        <div className="roadmap-panel__head-row">
          <div className="roadmap-panel__div">
            <span className="roadmap-board__swatch" style={{ background: epic.division.color }} />
            <span className="roadmap-panel__div-name">{epic.division.name}</span>
          </div>
          <button type="button" className="roadmap-panel__close" onClick={onClose}>×</button>
        </div>
        <span className="roadmap-panel__pill" style={{ color: st.color, borderColor: st.color }}>{st.label}</span>
        <h2 className="roadmap-panel__title">{epic.name}</h2>
      </div>

      <div className="roadmap-panel__body">
        <div className="roadmap-panel__metrics">
          <div className="roadmap-panel__metric">
            <div className="roadmap-panel__metric-label">Story points</div>
            <div className="roadmap-panel__metric-value">{epic.sp}</div>
          </div>
          <div className="roadmap-panel__metric">
            <div className="roadmap-panel__metric-label">Avancement</div>
            <div className="roadmap-panel__metric-value">
              {Math.round(epic.progress * 100)}<span className="roadmap-panel__metric-unit">%</span>
            </div>
          </div>
        </div>

        <div className="roadmap-panel__progress">
          <div
            className="roadmap-panel__progress-fill"
            style={{ width: `${Math.round(epic.progress * 100)}%`, background: epic.division.color }}
          />
        </div>

        <dl className="roadmap-panel__rows">
          <div className="roadmap-panel__row">
            <dt>Période</dt>
            <dd>{period}</dd>
          </div>
          <div className="roadmap-panel__row">
            <dt>Responsable</dt>
            <dd>{epic.lead}</dd>
          </div>
          <div className="roadmap-panel__row">
            <dt>Sprint actif</dt>
            <dd className="roadmap-panel__row-mono">{epic.sprint}</dd>
          </div>
        </dl>

        {epic.desc && (
          <>
            <div className="roadmap-panel__section-label">Description</div>
            <p className="roadmap-panel__desc">{epic.desc}</p>
          </>
        )}
      </div>

      <div className="roadmap-panel__foot">
        {epic.jiraUrl ? (
          <Button variant="primary" onClick={() => window.open(epic.jiraUrl, '_blank', 'noopener')}>
            Ouvrir dans Jira →
          </Button>
        ) : (
          <Button variant="primary" disabled>Aucun lien Jira</Button>
        )}
        <Button variant="secondary" onClick={onClose}>Fermer</Button>
      </div>
    </div>
  );
};

const BuilderEditor = ({ editor, divisions, streams, sizes, entityOptions = [], setDraft, onSave, onDelete, onClose }) => {
  const { draft, mode } = editor;
  const canSave = !!draft.name.trim();
  return (
    <div className="roadmap-panel__inner">
      <div className="roadmap-panel__head roadmap-panel__head--editor">
        <div>
          <div className="roadmap-panel__eyebrow">Atelier</div>
          <h2 className="roadmap-panel__title roadmap-panel__title--small">
            {mode === 'edit' ? 'Modifier le sujet' : 'Nouveau sujet'}
          </h2>
        </div>
        <button type="button" className="roadmap-panel__close" onClick={onClose}>×</button>
      </div>

      <div className="roadmap-panel__body">
        <label className="roadmap-panel__field-label">Intitulé du sujet</label>
        <input
          type="text"
          className="roadmap-panel__input"
          value={draft.name}
          onChange={(e) => setDraft({ name: e.target.value })}
          placeholder="Ex. Refonte du tunnel d'achat"
        />

        <label className="roadmap-panel__field-label">Division</label>
        <div className="roadmap-panel__chips">
          {divisions.map((d) => {
            const active = draft.divKey === d.key;
            return (
              <button
                key={d.key}
                type="button"
                className={`roadmap-chip ${active ? 'roadmap-chip--active' : ''}`}
                style={active ? { background: d.color, borderColor: d.color, color: '#FFF' } : undefined}
                onClick={() => setDraft({ divKey: d.key })}
              >
                <span className="roadmap-chip__dot" style={{ background: active ? '#FFF' : d.color }} />
                {d.name}
              </button>
            );
          })}
        </div>

        <label className="roadmap-panel__field-label">Entité</label>
        <input
          type="text"
          className="roadmap-panel__input"
          list="roadmap-entity-options"
          value={draft.entity || ''}
          onChange={(e) => setDraft({ entity: e.target.value })}
          placeholder="Entité rattachée (optionnel)"
        />
        <datalist id="roadmap-entity-options">
          {entityOptions.map((n) => <option key={n} value={n} />)}
        </datalist>

        <label className="roadmap-panel__field-label">Estimation · T-shirt sizing</label>
        <div className="roadmap-panel__sizes">
          {SIZE_ORDER.map((sz) => {
            const active = draft.size === sz;
            return (
              <button
                key={sz}
                type="button"
                className={`roadmap-size ${active ? 'roadmap-size--active' : ''}`}
                onClick={() => setDraft({ size: sz })}
              >
                <span className="roadmap-size__big">{sz}</span>
                <span className="roadmap-size__sub">{sizes[sz]} sprint(s)</span>
              </button>
            );
          })}
        </div>

        <div className="roadmap-panel__two-cols">
          <div>
            <label className="roadmap-panel__field-label">Stream</label>
            <select
              className="roadmap-panel__select"
              value={draft.streamId}
              onChange={(e) => setDraft({ streamId: e.target.value })}
            >
              {streams.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="roadmap-panel__field-label">Début</label>
            <select
              className="roadmap-panel__select"
              value={String(draft.start)}
              onChange={(e) => setDraft({ start: parseInt(e.target.value, 10) })}
            >
              {Array.from({ length: TOTAL_MONTHS }, (_, i) => (
                <option key={i} value={i}>{monthShOf(i)} {yearOfIndex(i)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="roadmap-panel__foot">
        <Button variant="primary" onClick={onSave} disabled={!canSave}>
          {mode === 'edit' ? 'Enregistrer' : 'Créer le sujet'}
        </Button>
        {mode === 'edit' && (
          <Button variant="danger" onClick={onDelete}>Supprimer</Button>
        )}
      </div>
    </div>
  );
};

const SizeConfigModal = ({ open, onClose, sizes, onSave }) => {
  const [draft, setDraft] = useState(sizes);
  useEffect(() => { if (open) setDraft(sizes); }, [open, sizes]);

  const setVal = (sz, v) => {
    const n = parseFloat(String(v).replace(',', '.'));
    const clamped = Number.isFinite(n) ? Math.max(0.25, Math.min(26, n)) : 0.5;
    setDraft((d) => ({ ...d, [sz]: clamped }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Durées des tailles T-shirt (en sprints)"
      size="sm"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={() => { onSave(draft); onClose(); }}>Enregistrer</Button>
        </div>
      }
    >
      <div className="roadmap-sizecfg">
        <p className="roadmap-sizecfg__hint">Nombre de sprints par taille — décimales autorisées (ex. 0.5 = demi-sprint).</p>
        {SIZE_ORDER.map((sz) => (
          <div key={sz} className="roadmap-sizecfg__row">
            <span className="roadmap-sizecfg__label">{sz}</span>
            <Input
              type="number"
              min={0.25}
              max={26}
              step={0.5}
              value={draft[sz]}
              onChange={(e) => setVal(sz, e.target.value)}
            />
            <span className="roadmap-sizecfg__unit">sprint(s)</span>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default Roadmap;
