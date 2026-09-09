import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Input,
  Select,
  Badge,
  Modal,
  Spinner,
  SearchBar,
  FileUpload,
  Checkbox,
  useToast,
  AdvancedDataGrid
} from '@frhamon/design-system';
import * as epicService from '../services/epicService';
import * as sprintService from '../services/sprintService';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import Tabs from '../components/ui/Tabs';
import MultiSelectFilter from '../components/ui/MultiSelectFilter';
import EntityCellEditor from '../components/ui/EntityCellEditor';
import StatusMappingModal from '../components/ui/StatusMappingModal';
import TeamAvailabilityModal from '../components/sprint/TeamAvailabilityModal';
import { syncFromJira } from '../services/jiraService';
import { getCapacityStream } from '../services/timeoffService';
import { getTeamMembers } from '../services/teamMemberService';
import '../styles/Epics.css';

const ENTITY_COLORS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EF4444', '#14B8A6', '#F97316', '#06B6D4',
  '#84CC16', '#A855F7', '#D946EF', '#0EA5E9'
];

// Options pour les formulaires de création/édition
const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'A faire' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'review', label: 'En revue' },
  { value: 'done', label: 'Terminé' }
];

const CATEGORY_OPTIONS = [
  { value: 'feature', label: 'Feature' },
  { value: 'bug', label: 'Bug' },
  { value: 'improvement', label: 'Amélioration' },
  { value: 'tech_debt', label: 'Dette technique' },
  { value: 'documentation', label: 'Documentation' }
];

const PRIORITY_OPTIONS = [
  { value: 'highest', label: 'Highest' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'lowest', label: 'Lowest' }
];

// Année courante pour les filtres
const currentYear = new Date().getFullYear();

const Epics = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  // State for active tab
  const [activeTab, setActiveTab] = useState('table');

  // State for epics list
  const [epics, setEpics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0
  });

  // State for filters
  const [filters, setFilters] = useState({
    search: '',
    sprints: [],
    year: '',
    quarter: '',
    entityLabel: '',
    issueType: []
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [collapsedEpics, setCollapsedEpics] = useState(new Set());

  const handleSort = useCallback((key) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  }, []);

  const toggleEpicCollapse = useCallback((epicKey) => {
    setCollapsedEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicKey)) next.delete(epicKey);
      else next.add(epicKey);
      return next;
    });
  }, []);

  // State for stats (delivered story points)
  const [stats, setStats] = useState({
    totalEpics: 0,
    totalStoryPoints: 0,
    deliveredStoryPoints: 0,
    byEntity: []
  });

  // State for sprints dropdown
  const [sprints, setSprints] = useState([]);

  // State for roadmap
  const [roadmapEpics, setRoadmapEpics] = useState([]);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapSprintCount, setRoadmapSprintCount] = useState(6);
  const [roadmapSprintOffset, setRoadmapSprintOffset] = useState(null); // null = auto (last N)
  const [roadmapLabelWidth, setRoadmapLabelWidth] = useState(240);
  const [roadmapViewMode, setRoadmapViewMode] = useState('entity'); // 'entity' | 'flat'
  const isResizing = useRef(false);

  // Stream de capacité équipe (disponibilité par sprint) + édition des congés
  const [capacityStream, setCapacityStream] = useState([]);
  const [showAvailability, setShowAvailability] = useState(false);
  const [availabilityTeam, setAvailabilityTeam] = useState([]);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(240);

  // State for billing tab
  const [billingFilters, setBillingFilters] = useState({ sprints: [], entityLabel: '' });
  const [billingItems, setBillingItems] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);

  // State for modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showStatusMappingModal, setShowStatusMappingModal] = useState(false);
  const [jiraSyncing, setJiraSyncing] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // State for selected epic
  const [selectedEpic, setSelectedEpic] = useState(null);

  // State for form
  const [formData, setFormData] = useState({
    key: '',
    title: '',
    description: '',
    storyPoints: 0,
    status: 'backlog',
    category: 'feature',
    priority: 'medium',
    sprint: '',
    entityLabels: []
  });

  // State for entity labels autocomplete
  const [availableEntityLabels, setAvailableEntityLabels] = useState([]);
  const [entityLabelInput, setEntityLabelInput] = useState('');
  const [entityLabelColor, setEntityLabelColor] = useState('info');

  // State for import
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importOptions, setImportOptions] = useState({
    sheetName: '',
    headerRow: 1,
    defaultCategory: 'feature',
    skipDuplicates: true,
    sprint: ''
  });

  // Load epics
  const loadEpics = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: 200,
        ...Object.fromEntries(
          Object.entries(filters).filter(([key, value]) => {
            if (key === 'sprints' || key === 'issueType') return false; // handled separately
            return value != null && value !== '';
          })
        )
      };
      if (filters.sprints.length > 0) params.sprint = filters.sprints.join(',');
      if (filters.issueType.length > 0) params.issueType = filters.issueType.join(',');
      const response = await epicService.getEpics(params);
      setEpics(response.data);
      setPagination({
        page: response.page,
        pages: response.pages,
        total: response.total
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: t('epics.loadError')
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, filters, showToast, t]);

  // Load sprints for dropdown
  const loadSprints = useCallback(async () => {
    try {
      const response = await sprintService.getSprints();
      setSprints(response.data || []);
    } catch (error) {
      console.error('Error loading sprints:', error);
    }
  }, []);

  // Load available entity labels for autocomplete
  const loadEntityLabels = useCallback(async () => {
    try {
      const response = await epicService.getEntityLabels();
      // Normalize: handle old string-format labels from DB
      const raw = (response.data || []).map(label =>
        typeof label === 'string' ? { name: label, color: 'info' } : label
      ).filter(label => label.name);
      // Deduplicate by name
      const seen = new Set();
      const labels = raw.filter(l => {
        if (seen.has(l.name)) return false;
        seen.add(l.name);
        return true;
      });
      setAvailableEntityLabels(labels);
    } catch (error) {
      console.error('Error loading entity labels:', error);
    }
  }, []);

  // Load stats for story points summary
  const loadStats = useCallback(async () => {
    try {
      const params = {};
      if (filters.sprints.length > 0) params.sprint = filters.sprints.join(',');
      if (filters.year) params.year = filters.year;
      if (filters.quarter) params.quarter = filters.quarter;
      if (filters.issueType.length > 0) params.issueType = filters.issueType.join(',');

      const response = await epicService.getStats(params);
      const totals = response.data?.totals || {};

      // Pour les Epics, le backend retourne directement deliveredStoryPoints
      // Pour les autres types, on calcule à partir de byStatus
      let deliveredStoryPoints = totals.deliveredStoryPoints;
      if (deliveredStoryPoints === undefined) {
        const byStatus = response.data?.byStatus || [];
        const doneStats = byStatus.find(s => s.status === 'done');
        deliveredStoryPoints = doneStats?.totalStoryPoints || 0;
      }

      setStats({
        totalEpics: totals.totalEpics || 0,
        totalStoryPoints: totals.totalStoryPoints || 0,
        deliveredStoryPoints,
        byEntity: response.data?.byEntity || []
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [filters.sprints, filters.year, filters.quarter, filters.issueType]);

  useEffect(() => {
    loadEpics();
  }, [loadEpics]);

  useEffect(() => {
    loadSprints();
  }, [loadSprints]);

  useEffect(() => {
    loadEntityLabels();
  }, [loadEntityLabels]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleJiraSync = useCallback(async () => {
    setJiraSyncing(true);
    try {
      const result = await syncFromJira();
      showToast({
        type: 'success',
        message: t('jira.syncSuccess', {
          total: result.total,
          sp: result.totalStoryPoints
        })
      });
      loadEpics();
      loadStats();
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      if (err.response?.status === 404) {
        showToast({ type: 'warning', message: t('jira.configureFirst', 'Configurez d\'abord Jira dans Configuration › Jira.') });
      } else {
        showToast({ type: 'error', message: t('jira.syncError', { error: msg }) });
      }
    } finally {
      setJiraSyncing(false);
    }
  }, [showToast, t, loadEpics, loadStats]);

  // Load roadmap data (only when roadmap tab is active)
  const loadRoadmapData = useCallback(async () => {
    setRoadmapLoading(true);
    try {
      const params = { issueType: 'Epic', limit: 500, sort: 'key' };
      if (filters.year) params.year = filters.year;
      if (filters.quarter) params.quarter = filters.quarter;
      if (filters.sprints.length > 0) params.sprint = filters.sprints.join(',');
      if (filters.entityLabel) params.entityLabel = filters.entityLabel;
      const response = await epicService.getEpics(params);
      setRoadmapEpics(response.data || []);
    } catch (error) {
      console.error('Error loading roadmap data:', error);
    } finally {
      setRoadmapLoading(false);
    }
  }, [filters.year, filters.quarter, filters.sprints, filters.entityLabel]);

  useEffect(() => {
    if (activeTab === 'roadmap' || activeTab === 'charts') {
      loadRoadmapData();
    }
  }, [activeTab, loadRoadmapData]);

  // Charge le stream de capacité (dispo par sprint)
  const loadCapacityStream = useCallback(async () => {
    try {
      const res = await getCapacityStream();
      setCapacityStream(res.data || []);
    } catch (e) {
      setCapacityStream([]);
    }
  }, []);

  // Charge le stream + l'équipe quand la roadmap est active
  useEffect(() => {
    if (activeTab === 'roadmap') {
      loadCapacityStream();
      getTeamMembers().then(r => setAvailabilityTeam(r.data || [])).catch(() => setAvailabilityTeam([]));
    }
  }, [activeTab, loadCapacityStream]);

  // Index capacité par sprintId pour le rendu du stream
  const capacityById = useMemo(() => {
    const map = {};
    capacityStream.forEach(c => { if (c.sprintId) map[c.sprintId.toString()] = c; });
    return map;
  }, [capacityStream]);

  const availabilityColor = (pct) => {
    if (pct >= 80) return '#16a34a';
    if (pct >= 50) return '#f59e0b';
    return '#dc2626';
  };

  // Load billing data (only when billing tab is active)
  const loadBillingData = useCallback(async () => {
    if (billingFilters.sprints.length === 0) {
      setBillingItems([]);
      return;
    }
    setBillingLoading(true);
    try {
      const params = { sprint: billingFilters.sprints.join(','), limit: 1000, sort: 'issueType' };
      if (billingFilters.entityLabel) params.entityLabel = billingFilters.entityLabel;
      const response = await epicService.getEpics(params);
      setBillingItems(response.data?.data || response.data || []);
    } catch {
      showToast({ type: 'error', message: t('epics.billing.loadError') });
    } finally {
      setBillingLoading(false);
    }
  }, [billingFilters, showToast, t]);

  useEffect(() => {
    if (activeTab === 'billing') loadBillingData();
  }, [activeTab, loadBillingData]);

  // Compute billing grouping by entity, with epics → children hierarchy
  const billingByEntity = useMemo(() => {
    if (billingItems.length === 0) return {};
    const groups = {};

    billingItems.forEach(item => {
      const labels = item.entityLabels?.length > 0
        ? [...new Set(item.entityLabels.map(l => l.name).filter(Boolean))]
        : [t('epics.billing.noEntity')];

      labels.forEach(label => {
        if (!groups[label]) groups[label] = { epicMap: {}, orphans: [], totalSP: 0, doneSP: 0 };
        const g = groups[label];

        const isEpic = item.issueType?.toLowerCase() === 'epic';

        // totalSP et doneSP ne comptent que les US (non-épics)
        // pour être cohérents avec le "Total US" affiché dans le footer du tableau
        if (!isEpic) {
          g.totalSP += item.storyPoints || 0;
          if (item.status === 'done') g.doneSP += item.storyPoints || 0;
        }

        if (isEpic) {
          if (!g.epicMap[item.key]) g.epicMap[item.key] = { epic: null, children: [] };
          g.epicMap[item.key].epic = item;
        } else if (item.parentKey) {
          if (!g.epicMap[item.parentKey]) g.epicMap[item.parentKey] = { epic: null, children: [] };
          g.epicMap[item.parentKey].children.push(item);
        } else {
          g.orphans.push(item);
        }
      });
    });
    return groups;
  }, [billingItems, t]);

  const billingSummary = useMemo(() => ({
    totalItems: billingItems.length,
    totalSP: billingItems.reduce((s, i) => s + (i.storyPoints || 0), 0),
    doneSP: billingItems.filter(i => i.status === 'done').reduce((s, i) => s + (i.storyPoints || 0), 0)
  }), [billingItems]);

  const generateEmailHtml = useCallback(() => {
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' }) : '?';
    const selectedSprintNames = billingFilters.sprints.map(id => {
      const s = sprints.find(sp => sp._id === id);
      return s ? `${s.name} · ${fmtDate(s.startDate)} – ${fmtDate(s.endDate)}` : id;
    }).join(', ');

    const TH = 'padding:8px 12px;border:1px solid #E5E7EB;background:#F9FAFB;text-align:left;font-size:13px;';
    const TD = 'padding:6px 12px;border:1px solid #E5E7EB;font-size:13px;vertical-align:middle;';
    const TD_R = TD + 'text-align:right;';

    let html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1F2937;">`;
    html += `<p><strong>Période :</strong> ${selectedSprintNames}</p>`;
    html += `<p style="color:#6B7280;"><strong>${billingSummary.totalItems}</strong> éléments &nbsp;·&nbsp; <strong>${billingSummary.totalSP} SP</strong> total &nbsp;·&nbsp; <strong>${billingSummary.doneSP} SP</strong> livrés</p>`;

    Object.entries(billingByEntity).sort(([a], [b]) => a.localeCompare(b)).forEach(([entityName, data]) => {
      html += `<h3 style="margin:24px 0 4px;padding-bottom:6px;border-bottom:2px solid #E5E7EB;color:#1F2937;">${entityName}</h3>`;
      html += `<p style="margin:0 0 8px;color:#6B7280;font-size:12px;">${data.totalSP} SP &nbsp;·&nbsp; ${data.doneSP} SP livrés</p>`;
      html += `<table style="border-collapse:collapse;width:100%;margin-bottom:24px;">`;
      html += `<thead><tr><th style="${TH}">Type</th><th style="${TH}">Clé</th><th style="${TH}">Titre</th><th style="${TH}">Statut</th><th style="${TH}text-align:right;">SP</th></tr></thead><tbody>`;

      Object.entries(data.epicMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([epicKey, group]) => {
        const epicItem = group.epic;
        const epicTitle = epicItem?.title || group.children[0]?.parentSummary || epicKey;
        const epicBg = 'background:#F3F4F6;font-weight:600;';
        const epicDisplayKey = epicItem?.key || epicKey;
        const epicHref = epicItem?.jiraUrl || `https://jiranium-corp.atlassian.net/browse/${epicDisplayKey}`;
        const epicKeyCell = `<a href="${epicHref}" style="color:#0563C1;text-decoration:underline;font-family:monospace;font-weight:600;">${epicDisplayKey}</a>`;
        html += `<tr><td style="${TD}${epicBg}">Epic</td><td style="${TD}${epicBg}">${epicKeyCell}</td><td style="${TD}${epicBg}">${epicTitle}</td><td style="${TD}${epicBg}"></td><td style="${TD_R}${epicBg}"></td></tr>`;
        group.children.forEach(child => {
          const childHref = child.jiraUrl || `https://jiranium-corp.atlassian.net/browse/${child.key}`;
          const childKeyCell = `<a href="${childHref}" style="color:#0563C1;text-decoration:underline;font-family:monospace;">${child.key}</a>`;
          html += `<tr><td style="${TD}color:#6B7280;">${child.issueType || '—'}</td><td style="${TD}">${childKeyCell}</td><td style="${TD}padding-left:24px;">↳ ${child.title}</td><td style="${TD}">${child.status || '—'}</td><td style="${TD_R}">${child.storyPoints || 0}</td></tr>`;
        });
      });

      data.orphans.forEach(item => {
        const itemHref = item.jiraUrl || `https://jiranium-corp.atlassian.net/browse/${item.key}`;
        const itemKeyCell = `<a href="${itemHref}" style="color:#0563C1;text-decoration:underline;font-family:monospace;">${item.key}</a>`;
        html += `<tr><td style="${TD}color:#6B7280;">${item.issueType || '—'}</td><td style="${TD}">${itemKeyCell}</td><td style="${TD}">${item.title}</td><td style="${TD}">${item.status || '—'}</td><td style="${TD_R}">${item.storyPoints || 0}</td></tr>`;
      });

      const usSP = Object.values(data.epicMap).reduce((s, g) => s + g.children.reduce((cs, c) => cs + (c.storyPoints || 0), 0), 0)
        + data.orphans.reduce((s, i) => s + (i.storyPoints || 0), 0);
      const TFOOT = 'padding:8px 12px;border-top:2px solid #E5E7EB;background:#F9FAFB;font-weight:600;font-size:13px;';
      html += `</tbody><tfoot><tr><td colspan="4" style="${TFOOT}">Total US</td><td style="${TFOOT}text-align:right;">${usSP}</td></tr></tfoot></table>`;
    });

    html += `</div>`;
    return html;
  }, [billingByEntity, billingFilters.sprints, sprints, billingSummary]);

  const copyBillingToEmail = useCallback(async () => {
    const html = generateEmailHtml();

    // Méthode 1 : Clipboard API moderne avec text/html (meilleure compatibilité Outlook/Gmail)
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([html.replace(/<[^>]+>/g, '')], { type: 'text/plain' })
          })
        ]);
        showToast({ type: 'success', message: t('epics.billing.copied') });
        return;
      } catch {
        // Tombe sur la méthode 2
      }
    }

    // Méthode 2 : execCommand via un élément DOM temporaire (fallback)
    const el = document.createElement('div');
    el.innerHTML = html;
    el.style.cssText = 'position:fixed;left:-9999px;top:0;';
    el.contentEditable = 'true';
    document.body.appendChild(el);

    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    document.execCommand('copy');

    sel.removeAllRanges();
    document.body.removeChild(el);

    showToast({ type: 'success', message: t('epics.billing.copied') });
  }, [generateEmailHtml, showToast, t]);

  // Compute roadmap timeline data
  const roadmapData = useMemo(() => {
    if (roadmapEpics.length === 0) return null;

    // Collect all sprints with dates from epics
    const sprintMap = {};
    roadmapEpics.forEach(epic => {
      (epic.sprints || []).forEach(s => {
        if (s && s._id && s.startDate && s.endDate) {
          sprintMap[s._id] = s;
        }
      });
    });
    const timelineSprints = Object.values(sprintMap)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    if (timelineSprints.length === 0) return null;

    // Appliquer la fenêtre de sprints visibles
    const totalSprints = timelineSprints.length;
    const defaultOffset = Math.max(0, totalSprints - roadmapSprintCount);
    const effectiveOffset = Math.min(roadmapSprintOffset ?? defaultOffset, defaultOffset);
    const visibleSprints = timelineSprints.slice(effectiveOffset, effectiveOffset + roadmapSprintCount);

    if (visibleSprints.length === 0) return null;

    const timelineStart = new Date(visibleSprints[0].startDate);
    const timelineEnd = new Date(visibleSprints[visibleSprints.length - 1].endDate);
    const totalDays = Math.max(1, (timelineEnd - timelineStart) / (1000 * 60 * 60 * 24));

    const toPercent = (date) => {
      const d = new Date(date);
      return Math.max(0, Math.min(100, ((d - timelineStart) / (1000 * 60 * 60 * 24)) / totalDays * 100));
    };

    // Group epics by entity (only those with overlap with visible window)
    const entityGroups = {};
    roadmapEpics.forEach(epic => {
      const epicSprints = (epic.sprints || []).filter(s => s.startDate && s.endDate);
      if (epicSprints.length === 0) return;
      const epicStart = new Date(Math.min(...epicSprints.map(s => new Date(s.startDate))));
      const epicEnd = new Date(Math.max(...epicSprints.map(s => new Date(s.endDate))));
      if (epicEnd <= timelineStart || epicStart >= timelineEnd) return; // hors fenêtre
      const entityName = epic.entityLabels?.[0]?.name || '_noEntity';
      if (!entityGroups[entityName]) entityGroups[entityName] = [];
      entityGroups[entityName].push(epic);
    });
    const entityNames = Object.keys(entityGroups).sort((a, b) => {
      if (a === '_noEntity') return 1;
      if (b === '_noEntity') return -1;
      return a.localeCompare(b);
    });

    // Assign colors
    const entityColorMap = {};
    entityNames.forEach((name, i) => {
      entityColorMap[name] = ENTITY_COLORS[i % ENTITY_COLORS.length];
    });

    const visibleSprintIds = new Set(visibleSprints.map(s => s._id?.toString()));
    return { timelineSprints: visibleSprints, toPercent, entityGroups, entityNames, entityColorMap, totalSprints, effectiveOffset, visibleSprintIds };
  }, [roadmapEpics, roadmapSprintCount, roadmapSprintOffset]);

  // Reset sprint offset when roadmap data changes (new filter applied)
  useEffect(() => {
    setRoadmapSprintOffset(null);
  }, [roadmapEpics]);

  // Données de l'histogramme « SP par Epic » (Top 20 par SP rattachés)
  const epicSpChartData = useMemo(() => {
    return roadmapEpics
      .map(e => ({
        name: e.title || e.key,
        key: e.key,
        totalSP: e.childrenTotalSP || 0,
        deliveredSP: e.childrenDeliveredSP || 0
      }))
      .filter(e => e.totalSP > 0)
      .sort((a, b) => b.totalSP - a.totalSP)
      .slice(0, 20);
  }, [roadmapEpics]);

  // Resize listeners for roadmap left column
  useEffect(() => {
    const onMove = (e) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(500, Math.max(160, resizeStartWidth.current + e.clientX - resizeStartX.current));
      setRoadmapLabelWidth(newWidth);
    };
    const onUp = () => { isResizing.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Handle search
  const handleSearch = (value) => {
    setFilters({ ...filters, search: value });
    setPagination({ ...pagination, page: 1 });
  };

  // Handle filter change (value can be a string or a React event from native <select>)
  const handleFilterChange = (name, value) => {
    const v = (value && value.target) ? value.target.value : value;
    setFilters({ ...filters, [name]: v ?? '' });
    setPagination({ ...pagination, page: 1 });
  };

  // Handle form change (value can be a string or a React event from native <select>)
  const handleFormChange = (name, value) => {
    const v = (value && value.target) ? value.target.value : value;
    setFormData({ ...formData, [name]: v });
  };

  // Clean form data before sending to API (convert empty strings to null for ObjectId fields)
  const cleanFormData = () => {
    const data = { ...formData };
    // Convertir sprint single → sprints array
    data.sprints = data.sprint ? [data.sprint] : [];
    delete data.sprint;
    return data;
  };

  // Handle create epic
  const handleCreate = async () => {
    try {
      await epicService.createEpic(cleanFormData());
      showToast({
        type: 'success',
        message: t('epics.createSuccess')
      });
      setShowCreateModal(false);
      resetForm();
      loadEpics();
    } catch (error) {
      showToast({
        type: 'error',
        message: error.response?.data?.message || t('epics.createError')
      });
    }
  };

  // Handle update epic
  const handleUpdate = async () => {
    try {
      const response = await epicService.updateEpic(selectedEpic._id, cleanFormData());
      showToast({
        type: 'success',
        message: t('epics.updateSuccess')
      });
      // Le backend signale si la propagation des labels vers Jira a échoué.
      if (response?.jiraWarning) {
        showToast({ type: 'warning', message: response.jiraWarning });
      }
      setShowEditModal(false);
      resetForm();
      loadEpics();
      loadEntityLabels(); // Refresh available labels for autocomplete
    } catch (error) {
      showToast({
        type: 'error',
        message: error.response?.data?.message || t('epics.updateError')
      });
    }
  };

  // Sauvegarde inline de l'entité depuis le tableau (réutilise updateEpic → synchro Jira).
  const handleInlineEntitySave = useCallback(async (row, entityLabels) => {
    try {
      const response = await epicService.updateEpic(row._id, { entityLabels });
      showToast({ type: 'success', message: t('epics.updateSuccess') });
      if (response?.jiraWarning) {
        showToast({ type: 'warning', message: response.jiraWarning });
      }
      loadEpics();
      loadEntityLabels();
    } catch (error) {
      showToast({ type: 'error', message: error.response?.data?.message || t('epics.updateError') });
    }
  }, [showToast, t, loadEpics, loadEntityLabels]);

  // Handle delete epic
  const handleDelete = async () => {
    try {
      await epicService.deleteEpic(selectedEpic._id);
      showToast({
        type: 'success',
        message: t('epics.deleteSuccess')
      });
      setShowDeleteModal(false);
      setSelectedEpic(null);
      loadEpics();
    } catch (error) {
      showToast({
        type: 'error',
        message: error.response?.data?.message || t('epics.deleteError')
      });
    }
  };

  // Open edit modal
  const openEditModal = useCallback((epic) => {
    setSelectedEpic(epic);
    setFormData({
      key: epic.key,
      title: epic.title,
      description: epic.description || '',
      storyPoints: epic.storyPoints || 0,
      status: epic.status,
      category: epic.category,
      priority: epic.priority || 'medium',
      sprint: epic.sprints?.[0]?._id || '',
      entityLabels: epic.entityLabels || []
    });
    setEntityLabelInput('');
    setShowEditModal(true);
  }, []);

  // Open delete modal
  const openDeleteModal = useCallback((epic) => {
    setSelectedEpic(epic);
    setShowDeleteModal(true);
  }, []);

  // Reset form
  const resetForm = () => {
    setFormData({
      key: '',
      title: '',
      description: '',
      storyPoints: 0,
      status: 'backlog',
      category: 'feature',
      priority: 'medium',
      sprint: '',
      entityLabels: []
    });
    setEntityLabelInput('');
    setEntityLabelColor('info');
    setSelectedEpic(null);
  };

  // Handle entity label add
  const handleAddEntityLabel = (labelName, color) => {
    const trimmedLabel = labelName.trim();
    const labelColor = color || entityLabelColor;
    if (trimmedLabel && !formData.entityLabels.some(l => l.name === trimmedLabel) && formData.entityLabels.length < 2) {
      setFormData({ ...formData, entityLabels: [...formData.entityLabels, { name: trimmedLabel, color: labelColor }] });
      setEntityLabelInput('');
      setEntityLabelColor('info');
      // Refresh available labels after adding a new one
      if (!availableEntityLabels.some(l => l.name === trimmedLabel)) {
        setAvailableEntityLabels([...availableEntityLabels, { name: trimmedLabel, color: labelColor }].sort((a, b) => a.name.localeCompare(b.name)));
      }
    }
  };

  // Handle entity label remove
  const handleRemoveEntityLabel = (labelName) => {
    setFormData({ ...formData, entityLabels: formData.entityLabels.filter(l => l.name !== labelName) });
  };

  // Get filtered suggestions for entity label autocomplete
  const getEntityLabelSuggestions = () => {
    if (!entityLabelInput.trim()) return [];
    return availableEntityLabels.filter(
      label => label.name && label.name.toLowerCase().includes(entityLabelInput.toLowerCase()) &&
               !formData.entityLabels.some(l => l.name === label.name)
    );
  };

  // Handle file select for import
  const handleFileSelect = async (file) => {
    setImportFile(file);
    setImportLoading(true);
    try {
      const preview = await epicService.previewImport(file, importOptions);
      setImportPreview(preview);
      setShowImportModal(false);
      setShowPreviewModal(true);
    } catch (error) {
      showToast({
        type: 'error',
        message: error.response?.data?.message || t('epics.importPreviewError')
      });
    } finally {
      setImportLoading(false);
    }
  };

  // Handle import confirmation
  const handleImportConfirm = async () => {
    if (!importFile) return;

    setImportLoading(true);
    try {
      const result = await epicService.importEpics(importFile, importOptions);
      const sp = result.data?.totalStoryPoints;
      showToast({
        type: 'success',
        message: sp > 0
          ? `${result.message} — ${sp} SP`
          : result.message
      });
      setShowPreviewModal(false);
      setImportFile(null);
      setImportPreview(null);
      loadEpics();
    } catch (error) {
      showToast({
        type: 'error',
        message: error.response?.data?.message || t('epics.importError')
      });
    } finally {
      setImportLoading(false);
    }
  };

  // Build sprints options for select
  const sprintOptions = [
    { value: '', label: t('epics.noSprint') },
    ...sprints.map(s => ({ value: s._id, label: s.name }))
  ];

  // Build year options for filter
  const yearOptions = [
    { value: '', label: t('epics.allYears') },
    ...Array.from({ length: 5 }, (_, i) => ({
      value: String(currentYear - i),
      label: String(currentYear - i)
    }))
  ];

  // Build quarter options for filter
  const quarterOptions = [
    { value: '', label: t('epics.allQuarters') },
    { value: '1', label: 'T1 (Jan-Mar)' },
    { value: '2', label: 'T2 (Avr-Jun)' },
    { value: '3', label: 'T3 (Jul-Sep)' },
    { value: '4', label: 'T4 (Oct-Dec)' }
  ];

  // Transform epics to rows for AdvancedDataGrid, grouping children under their parent epic
  const { rows, epicsWithChildren } = useMemo(() => {
    const allItems = epics.map(epic => ({ id: epic._id, ...epic }));

    const sortItems = (items) => {
      if (!sortConfig.key) return items;
      return [...items].sort((a, b) => {
        let aVal, bVal;
        if (sortConfig.key === 'storyPoints') {
          const effSP = (it) => (it.issueType?.toLowerCase() === 'epic' ? (it.childrenTotalSP || 0) : (it.storyPoints || 0));
          aVal = effSP(a);
          bVal = effSP(b);
        } else if (sortConfig.key === 'entityLabels') {
          aVal = (a.entityLabels?.[0]?.name || a.entityLabels?.[0] || '').toLowerCase();
          bVal = (b.entityLabels?.[0]?.name || b.entityLabels?.[0] || '').toLowerCase();
        } else {
          aVal = (a[sortConfig.key] || '').toString().toLowerCase();
          bVal = (b[sortConfig.key] || '').toString().toLowerCase();
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    };

    const epicItems = sortItems(allItems.filter(item => item.issueType?.toLowerCase() === 'epic'));
    const nonEpicItems = allItems.filter(item => item.issueType?.toLowerCase() !== 'epic');

    const childrenByParent = {};
    nonEpicItems.forEach(item => {
      if (item.parentKey) {
        if (!childrenByParent[item.parentKey]) childrenByParent[item.parentKey] = [];
        childrenByParent[item.parentKey].push(item);
      }
    });

    const epicsWithChildren = new Set(Object.keys(childrenByParent));

    if (nonEpicItems.length === 0) return { rows: epicItems, epicsWithChildren };

    const result = [];
    const attachedIds = new Set();

    epicItems.forEach(epic => {
      result.push(epic);
      if (!collapsedEpics.has(epic.key)) {
        (childrenByParent[epic.key] || []).forEach(child => {
          result.push({ ...child, _parentKey: epic.key });
          attachedIds.add(child.id);
        });
      } else {
        (childrenByParent[epic.key] || []).forEach(child => {
          attachedIds.add(child.id);
        });
      }
    });

    // Items whose parent epic is not on the current page
    sortItems(nonEpicItems).forEach(item => {
      if (!attachedIds.has(item.id)) result.push(item);
    });

    return { rows: result, epicsWithChildren };
  }, [epics, sortConfig, collapsedEpics]);

  // Helpers for issue type badge variant and icon
  const getIssueTypeBadgeVariant = (type) => {
    if (!type) return 'default';
    switch (type.toLowerCase()) {
      case 'epic': return 'primary';
      case 'story': return 'success';
      case 'bug': return 'error';
      case 'task': return 'info';
      case 'sub-task': return 'warning';
      default: return 'default';
    }
  };

  const getIssueTypeIcon = (type) => {
    if (!type) return 'bi-question-circle';
    switch (type.toLowerCase()) {
      case 'epic': return 'bi-lightning-fill';
      case 'story': return 'bi-bookmark-fill';
      case 'bug': return 'bi-bug-fill';
      case 'task': return 'bi-check-square-fill';
      case 'sub-task': return 'bi-diagram-3-fill';
      default: return 'bi-circle';
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'done': return 'success';
      case 'in_progress': return 'warning';
      case 'review': return 'info';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const isEpicFilter = filters.issueType.length === 1 && filters.issueType[0].toLowerCase() === 'epic';

  const activeFilterCount = [
    filters.sprints.length > 0,
    !!filters.year,
    !!filters.quarter,
    filters.issueType.length > 0,
    !!filters.entityLabel
  ].filter(Boolean).length;

  // Define columns for AdvancedDataGrid
  const columns = useMemo(() => {
    const sortLabel = (key, text) => (
      <button className="epics-table__sort-btn" onClick={() => handleSort(key)}>
        {text}
        {sortConfig.key === key
          ? <i className={`bi bi-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}-alt`} />
          : <i className="bi bi-arrow-down-up epics-table__sort-icon--idle" />}
      </button>
    );

    const cols = [
      {
        id: 'key',
        label: sortLabel('key', t('epics.key')),
        width: 120,
        editable: false,
        render: (value, row) => {
          const isEpicRow = row.issueType?.toLowerCase() === 'epic';
          const hasChildren = epicsWithChildren.has(row.key);
          const isCollapsed = collapsedEpics.has(row.key);
          return (
            <div className={`epics-table__key-wrap${row.parentKey ? ' epics-table__key-wrap--child' : ''}`}>
              {isEpicRow && hasChildren ? (
                <button
                  className="epics-table__collapse-btn"
                  onClick={() => toggleEpicCollapse(row.key)}
                  title={isCollapsed ? 'Déplier' : 'Replier'}
                >
                  <i className={`bi bi-chevron-${isCollapsed ? 'right' : 'down'}`} />
                </button>
              ) : (
                <span className="epics-table__collapse-spacer" />
              )}
              {row.parentKey && <span className="epics-table__child-connector" aria-hidden="true" />}
              <a
                href={`https://jiranium-corp.atlassian.net/browse/${row.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="epics-table__key"
              >
                {row.key}
              </a>
            </div>
          );
        }
      },
      {
        id: 'issueType',
        label: t('epics.issueType'),
        width: 110,
        editable: false,
        render: (value, row) => {
          if (!row.issueType) return '-';
          const isEpicType = row.issueType.toLowerCase() === 'epic';
          return (
            <Badge
              variant={getIssueTypeBadgeVariant(row.issueType)}
              size="sm"
              rounded
              className={`epics-table__type-badge ${isEpicType ? 'epics-table__type-badge--epic' : ''}`}
            >
              <i className={`bi ${getIssueTypeIcon(row.issueType)} epics-table__type-icon`}></i>
              {row.issueType}
            </Badge>
          );
        }
      },
      {
        id: 'title',
        label: t('epics.titleField'),
        width: 400,
        editable: false,
        render: (value, row) => (
          <span className={`epics-table__title${row.parentKey ? ' epics-table__title--child' : ''}`}>
            {row.title}
          </span>
        )
      },
      {
        id: 'status',
        label: sortLabel('status', t('epics.status.label')),
        width: 100,
        editable: false,
        render: (value, row) => (
          row.status ? (
            <Badge variant={getStatusBadgeVariant(row.status)} size="sm" dot rounded>
              {t(`epics.status.${row.status}`, row.status)}
            </Badge>
          ) : '-'
        )
      },
      {
        id: 'storyPoints',
        label: sortLabel('storyPoints', t('epics.storyPoints')),
        width: 60,
        editable: false,
        render: (value, row) => {
          // Les SP Jira sont sur les stories ; pour un Epic on affiche le total de ses enfants.
          const isEpicRow = row.issueType?.toLowerCase() === 'epic';
          const sp = isEpicRow ? (row.childrenTotalSP || 0) : (row.storyPoints || 0);
          return sp > 0
            ? <span className="epics-table__points">{sp}</span>
            : <span className="epics-table__points epics-table__points--empty">—</span>;
        }
      },
      {
        id: 'sprints',
        label: t('epics.sprint'),
        width: 150,
        editable: false,
        render: (value, row) => {
          if (!row.sprints || row.sprints.length === 0) return '-';
          const first = row.sprints[0];
          const rest = row.sprints.length - 1;
          const allNames = row.sprints.map(s => s.name || s).join(', ');
          return (
            <div className="epics-table__tags" title={rest > 0 ? allNames : undefined}>
              <Badge variant="default" size="sm" rounded>{first.name || first}</Badge>
              {rest > 0 && (
                <span className="epics-table__tags-more" title={allNames}>+{rest}</span>
              )}
            </div>
          );
        }
      }
    ];

    // Add children columns only when filtering by Epic
    if (isEpicFilter) {
      cols.push(
        {
          id: 'childrenCount',
          label: t('epics.childrenCount'),
          width: 60,
          editable: false,
          render: (value, row) => (
            <span className="epics-table__points">{row.childrenCount || 0}</span>
          )
        },
        {
          id: 'childrenDeliveredSP',
          label: t('epics.deliveredStoryPoints'),
          width: 60,
          editable: false,
          render: (value, row) => (
            <span className="epics-table__points epics-table__delivered">
              <span className="delivered-sp">{row.childrenDeliveredSP || 0} SP</span>
            </span>
          )
        }
      );
    }

    cols.push(
      {
        id: 'entityLabels',
        label: sortLabel('entityLabels', t('epics.entityLabels')),
        width: 80,
        editable: false,
        render: (value, row) => (
          <EntityCellEditor
            row={row}
            availableLabels={availableEntityLabels}
            onSave={handleInlineEntitySave}
          />
        )
      },
      {
        id: 'actions',
        label: t('common.actions'),
        width: 100,
        editable: false,
        render: (value, row) => (
          <div className="epics-table__actions epics-table__actions--hover-only">
            <button
              className="epics-table__action-btn epics-table__action-btn--edit"
              onClick={() => openEditModal(row)}
              title={t('common.edit')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button
              className="epics-table__action-btn epics-table__action-btn--delete"
              onClick={() => openDeleteModal(row)}
              title={t('common.delete')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        )
      }
    );

    return cols;
  }, [t, isEpicFilter, openEditModal, openDeleteModal, sortConfig, handleSort, epicsWithChildren, collapsedEpics, toggleEpicCollapse, availableEntityLabels, handleInlineEntitySave]);

  return (
    <div className="epics-page">
      <div className="epics-header">
        <div className="epics-header__title">
          <h1>{t('epics.title')}</h1>
          <p className="epics-header__subtitle">{t('epics.subtitle')}</p>
        </div>
        <div className="epics-header__actions">
          <button
            className="epics-header__icon-btn"
            onClick={() => setShowStatusMappingModal(true)}
            title={t('statusMapping.configureTitle')}
          >
            <i className="bi bi-sliders"></i>
            <span className="epics-header__icon-btn-label">{t('statusMapping.configureTitle')}</span>
          </button>
          <Button
            variant="secondary"
            onClick={handleJiraSync}
            loading={jiraSyncing}
          >
            <i className="bi bi-cloud-download me-2"></i>
            {t('jira.syncButton')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowImportModal(true)}
          >
            {t('epics.import')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
          >
            {t('epics.create')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="epics-filters">
        <div className="epics-filters__header">
          <div className="epics-filters__search">
            <SearchBar
              placeholder={t('epics.searchPlaceholder')}
              value={filters.search}
              onChange={handleSearch}
            />
          </div>
          <button
            className={`epics-filters__toggle${filtersOpen ? ' epics-filters__toggle--open' : ''}`}
            onClick={() => setFiltersOpen(o => !o)}
            aria-expanded={filtersOpen}
          >
            <i className="bi bi-funnel" />
            {t('common.filter')}
            {activeFilterCount > 0 && (
              <span className="epics-filters__badge">{activeFilterCount}</span>
            )}
            <i className={`bi bi-chevron-${filtersOpen ? 'up' : 'down'} epics-filters__chevron`} />
          </button>
        </div>
        {filtersOpen && (
          <div className="epics-filters__row">
            <Select
              options={yearOptions}
              value={filters.year}
              onChange={(value) => handleFilterChange('year', value)}
            />
            <Select
              options={quarterOptions}
              value={filters.quarter}
              onChange={(value) => handleFilterChange('quarter', value)}
            />
            <MultiSelectFilter
              options={sprints.map(s => ({ value: s._id, label: s.name }))}
              value={filters.sprints}
              onChange={(values) => {
                setFilters({ ...filters, sprints: values });
                setPagination({ ...pagination, page: 1 });
              }}
              placeholder={t('epics.filterBySprint')}
            />
            <MultiSelectFilter
              options={[
                { value: 'Epic', label: t('epics.issueTypes.epic') },
                { value: 'Story', label: t('epics.issueTypes.story') },
                { value: 'Task', label: t('epics.issueTypes.task') },
                { value: 'Sub-task', label: t('epics.issueTypes.sub-task') },
                { value: 'Bug', label: t('epics.issueTypes.bug') }
              ]}
              value={filters.issueType}
              onChange={(values) => {
                setFilters({ ...filters, issueType: values });
                setPagination({ ...pagination, page: 1 });
              }}
              placeholder={t('epics.allTypes')}
            />
            <Select
              options={[
                { value: '', label: t('epics.allEntities') },
                { value: '__none__', label: t('epics.noEntityFilter') },
                ...availableEntityLabels.map(label => ({
                  value: label.name,
                  label: label.name
                }))
              ]}
              value={filters.entityLabel}
              onChange={(value) => handleFilterChange('entityLabel', value)}
            />
          </div>
        )}
      </Card>

      {/* Tabs */}
      <Tabs
        tabs={[
          {
            id: 'table',
            label: (
              <span className="epics-tab__label">
                {t('epics.tabs.table')}
                {pagination.total > 0 && (
                  <span className="epics-tab__count">{pagination.total}</span>
                )}
              </span>
            )
          },
          { id: 'charts', label: t('epics.tabs.charts') },
          { id: 'roadmap', label: t('epics.tabs.roadmap') },
          { id: 'billing', label: t('epics.tabs.billing') }
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        variant="underline"
      />

      {/* Tab: Table */}
      {activeTab === 'table' && (
        <>
          {/* Stats summary */}
          <div className="epics-stats">
            <Card className="epics-stats__card">
              <div className="epics-stats__item">
                <span className="epics-stats__label">{t('epics.totalItems')}</span>
                <span className="epics-stats__value">{stats.totalEpics}</span>
              </div>
            </Card>
            <Card className="epics-stats__card">
              <div className="epics-stats__item">
                <span className="epics-stats__label">{t('epics.totalStoryPoints')}</span>
                <span className="epics-stats__value">{stats.totalStoryPoints} SP</span>
              </div>
            </Card>
            <Card className="epics-stats__card epics-stats__card--delivered">
              <div className="epics-stats__item">
                <span className="epics-stats__label">{t('epics.deliveredStoryPoints')}</span>
                <span className="epics-stats__value epics-stats__value--success">{stats.deliveredStoryPoints} SP</span>
                {stats.totalStoryPoints > 0 && (
                  <span className="epics-stats__delta">
                    {t('epics.deliveredStoryPointsDelta', {
                      percent: Math.round((stats.deliveredStoryPoints / stats.totalStoryPoints) * 100)
                    })}
                  </span>
                )}
              </div>
            </Card>
          </div>

          {/* Epics list */}
          <Card className="epics-list">
            {loading ? (
              <div className="epics-list__loading">
                <Spinner size="lg" />
              </div>
            ) : epics.length === 0 ? (
              <div className="epics-list__empty">
                <p>{t('epics.noEpics')}</p>
                <Button
                  variant="primary"
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                >
                  {t('epics.createFirst')}
                </Button>
              </div>
            ) : (
              <>
                <AdvancedDataGrid
                  columns={columns}
                  rows={rows}
                  sortable={true}
                  filterable={false}
                  className="epics-data-grid"
                />

                {/* Pagination */}
                {pagination.pages > 1 && (
                  <div className="epics-pagination">
                    <Button
                      variant="secondary"
                      size="small"
                      disabled={pagination.page === 1}
                      onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    >
                      {t('common.previous')}
                    </Button>
                    <span className="epics-pagination__info">
                      {t('epics.pagination', { page: pagination.page, pages: pagination.pages })}
                    </span>
                    <Button
                      variant="secondary"
                      size="small"
                      disabled={pagination.page === pagination.pages}
                      onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        </>
      )}

      {/* Tab: Charts */}
      {activeTab === 'charts' && (
        <div className="epics-charts">
          <Card className="epics-charts__card">
            <h3 className="epics-charts__title">{t('epics.charts.entityDistribution')}</h3>
            {stats.byEntity.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={stats.byEntity.map(e => ({ name: e.entity, value: e.count }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={140}
                    innerRadius={60}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={true}
                  >
                    {stats.byEntity.map((_, index) => (
                      <Cell key={index} fill={ENTITY_COLORS[index % ENTITY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} items`, 'Nombre']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="epics-charts__empty">
                <p>{t('epics.charts.noData')}</p>
              </div>
            )}
          </Card>

          <Card className="epics-charts__card">
            <h3 className="epics-charts__title">{t('epics.charts.epicStoryPoints')}</h3>
            {epicSpChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(320, epicSpChartData.length * 34)}>
                <BarChart
                  data={epicSpChartData}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={220}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => (v.length > 32 ? `${v.slice(0, 31)}…` : v)}
                  />
                  <Tooltip formatter={(value, key) => [`${value} SP`, key === 'deliveredSP' ? t('epics.charts.deliveredSP') : t('epics.charts.totalSP')]} />
                  <Legend />
                  <Bar dataKey="totalSP" name={t('epics.charts.totalSP')} fill="#4361ee" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="deliveredSP" name={t('epics.charts.deliveredSP')} fill="#16a34a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="epics-charts__empty">
                <p>{t('epics.charts.noData')}</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab: Roadmap */}
      {activeTab === 'roadmap' && (
        <Card className="epics-roadmap">
          {roadmapLoading ? (
            <div className="epics-roadmap__loading">
              <Spinner size="lg" />
            </div>
          ) : !roadmapData ? (
            <div className="epics-roadmap__empty">
              <p>{t('epics.roadmap.noData')}</p>
            </div>
          ) : (
            <>
              {/* Navigation controls */}
              <div className="epics-roadmap__controls">
                <button
                  className="epics-roadmap__nav-btn"
                  disabled={roadmapData.effectiveOffset === 0}
                  onClick={() => setRoadmapSprintOffset(o => Math.max(0, (o ?? roadmapData.effectiveOffset) - 1))}
                >
                  <i className="bi bi-chevron-left" />
                </button>
                <span className="epics-roadmap__controls-label">
                  Sprints {roadmapData.effectiveOffset + 1}–{Math.min(roadmapData.effectiveOffset + roadmapSprintCount, roadmapData.totalSprints)} / {roadmapData.totalSprints}
                </span>
                <button
                  className="epics-roadmap__nav-btn"
                  disabled={roadmapData.effectiveOffset >= roadmapData.totalSprints - roadmapSprintCount}
                  onClick={() => setRoadmapSprintOffset(o => (o ?? roadmapData.effectiveOffset) + 1)}
                >
                  <i className="bi bi-chevron-right" />
                </button>
                <select
                  className="epics-roadmap__count-select"
                  value={roadmapSprintCount}
                  onChange={e => {
                    setRoadmapSprintCount(Number(e.target.value));
                    setRoadmapSprintOffset(null);
                  }}
                >
                  {[3, 6, 9, 12].map(n => (
                    <option key={n} value={n}>{n} sprints</option>
                  ))}
                </select>
                <div className="epics-roadmap__view-toggle">
                  <button
                    className={`epics-roadmap__view-btn ${roadmapViewMode === 'entity' ? 'epics-roadmap__view-btn--active' : ''}`}
                    title="Vue par entité"
                    onClick={() => setRoadmapViewMode('entity')}
                  >
                    <i className="bi bi-diagram-3" />
                  </button>
                  <button
                    className={`epics-roadmap__view-btn ${roadmapViewMode === 'flat' ? 'epics-roadmap__view-btn--active' : ''}`}
                    title="Vue consolidée"
                    onClick={() => setRoadmapViewMode('flat')}
                  >
                    <i className="bi bi-list-ul" />
                  </button>
                </div>
              </div>

              {/* Sprint columns header */}
              <div className="epics-roadmap__timeline">
                <div className="epics-roadmap__labels-col" style={{ width: roadmapLabelWidth, flexShrink: 0 }}>
                  <div className="epics-roadmap__header-label">&nbsp;</div>
                </div>
                <div
                  className="epics-roadmap__resize-handle"
                  onMouseDown={(e) => {
                    isResizing.current = true;
                    resizeStartX.current = e.clientX;
                    resizeStartWidth.current = roadmapLabelWidth;
                  }}
                />
                <div className="epics-roadmap__chart-col">
                  <div className="epics-roadmap__sprints-header">
                    {roadmapData.timelineSprints.map(s => {
                      const left = roadmapData.toPercent(s.startDate);
                      const width = roadmapData.toPercent(s.endDate) - left;
                      return (
                        <div
                          key={s._id}
                          className={`epics-roadmap__sprint-col ${s.status === 'active' ? 'epics-roadmap__sprint-col--active' : ''}`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          <span className="epics-roadmap__sprint-name">{s.name}</span>
                          <span className="epics-roadmap__sprint-dates">
                            {new Date(s.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            {' — '}
                            {new Date(s.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Epic rows — vue par entité */}
              {roadmapViewMode === 'entity' && (
                <div className="epics-roadmap__body">
                  {roadmapData.entityNames.map(entityName => (
                    <div key={entityName} className="epics-roadmap__entity-group">
                      <div className="epics-roadmap__entity-header">
                        <span
                          className="epics-roadmap__entity-dot"
                          style={{ background: roadmapData.entityColorMap[entityName] }}
                        />
                        <span className="epics-roadmap__entity-name">
                          {entityName === '_noEntity' ? t('epics.roadmap.noEntity') : entityName}
                        </span>
                        <span className="epics-roadmap__entity-count">
                          {roadmapData.entityGroups[entityName].length}
                        </span>
                      </div>
                      {roadmapData.entityGroups[entityName].map(epic => {
                        const epicSprints = (epic.sprints || []).filter(s => s.startDate && s.endDate);
                        const epicVisibleSprints = epicSprints.filter(s => roadmapData.visibleSprintIds.has(s._id?.toString()));
                        if (epicVisibleSprints.length === 0) return null;
                        const sprintStatsMap = {};
                        (epic.sprintStats || []).forEach(s => { if (s._id) sprintStatsMap[s._id.toString()] = s; });

                        return (
                          <div key={epic._id} className="epics-roadmap__row">
                            <div className="epics-roadmap__labels-col" style={{ width: roadmapLabelWidth, flexShrink: 0 }}>
                              <div className="epics-roadmap__tooltip-wrapper">
                                <span className="epics-roadmap__epic-title">{epic.title}</span>
                                <div className="epics-roadmap__tooltip">
                                  <a
                                    href={`https://jiranium-corp.atlassian.net/browse/${epic.key}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {epic.key}
                                  </a>
                                  <span>{epic.childrenTotalSP || 0} SP · {epic.childrenCount || 0} items</span>
                                </div>
                              </div>
                            </div>
                            <div
                              className="epics-roadmap__resize-handle"
                              onMouseDown={(e) => {
                                isResizing.current = true;
                                resizeStartX.current = e.clientX;
                                resizeStartWidth.current = roadmapLabelWidth;
                              }}
                            />
                            <div className="epics-roadmap__chart-col">
                              <div className="epics-roadmap__sprint-backgrounds">
                                {roadmapData.timelineSprints.map((s, i) => {
                                  const sLeft = roadmapData.toPercent(s.startDate);
                                  const sWidth = roadmapData.toPercent(s.endDate) - sLeft;
                                  return (
                                    <div
                                      key={s._id}
                                      className={`epics-roadmap__sprint-bg ${i % 2 === 0 ? 'epics-roadmap__sprint-bg--even' : ''} ${s.status === 'active' ? 'epics-roadmap__sprint-bg--active' : ''}`}
                                      style={{ left: `${sLeft}%`, width: `${sWidth}%` }}
                                    />
                                  );
                                })}
                              </div>
                              {epicVisibleSprints.map(sprint => {
                                const left = roadmapData.toPercent(sprint.startDate);
                                const width = roadmapData.toPercent(sprint.endDate) - left;
                                const ss = sprintStatsMap[sprint._id?.toString()];
                                const deliveredSP = ss?.deliveredSP || 0;
                                const totalSP = ss?.totalSP || 0;
                                return (
                                  <div
                                    key={sprint._id}
                                    className={`epics-roadmap__bar epics-roadmap__bar--${epic.status || 'backlog'}`}
                                    style={{
                                      left: `${left}%`,
                                      width: `${Math.max(width, 1)}%`,
                                      background: roadmapData.entityColorMap[entityName]
                                    }}
                                    title={`${epic.key} — ${epic.title}\n${sprint.name}\n${deliveredSP} SP livrés / ${totalSP} SP total`}
                                  >
                                    {totalSP > 0 ? (
                                      <span className="epics-roadmap__bar-label">{deliveredSP} SP</span>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* Epic rows — vue consolidée (toutes entités, triés par date de début) */}
              {roadmapViewMode === 'flat' && (
                <div className="epics-roadmap__body">
                  {roadmapData.entityNames
                    .flatMap(entityName =>
                      roadmapData.entityGroups[entityName].map(epic => ({ ...epic, _entityName: entityName }))
                    )
                    .filter(epic => (epic.sprints || []).some(s => s.startDate && s.endDate))
                    .sort((a, b) => {
                      const aStart = Math.min(...(a.sprints || []).filter(s => s.startDate).map(s => new Date(s.startDate)));
                      const bStart = Math.min(...(b.sprints || []).filter(s => s.startDate).map(s => new Date(s.startDate)));
                      return aStart - bStart;
                    })
                    .map(epic => {
                      const entityName = epic._entityName;
                      const epicSprints = (epic.sprints || []).filter(s => s.startDate && s.endDate);
                      const epicVisibleSprints = epicSprints.filter(s => roadmapData.visibleSprintIds.has(s._id?.toString()));
                      if (epicVisibleSprints.length === 0) return null;
                      const sprintStatsMap = {};
                      (epic.sprintStats || []).forEach(s => { if (s._id) sprintStatsMap[s._id.toString()] = s; });

                      return (
                        <div key={epic._id} className="epics-roadmap__row">
                          <div className="epics-roadmap__labels-col" style={{ width: roadmapLabelWidth, flexShrink: 0 }}>
                            <span
                              className="epics-roadmap__entity-dot epics-roadmap__entity-dot--inline"
                              style={{ background: roadmapData.entityColorMap[entityName] }}
                            />
                            <div className="epics-roadmap__tooltip-wrapper">
                              <span className="epics-roadmap__epic-title">{epic.title}</span>
                              <div className="epics-roadmap__tooltip">
                                <a
                                  href={`https://jiranium-corp.atlassian.net/browse/${epic.key}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {epic.key}
                                </a>
                                <span>{epic.childrenTotalSP || 0} SP · {epic.childrenCount || 0} items</span>
                                <span className="epics-roadmap__tooltip-entity">
                                  {entityName === '_noEntity' ? t('epics.roadmap.noEntity') : entityName}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div
                            className="epics-roadmap__resize-handle"
                            onMouseDown={(e) => {
                              isResizing.current = true;
                              resizeStartX.current = e.clientX;
                              resizeStartWidth.current = roadmapLabelWidth;
                            }}
                          />
                          <div className="epics-roadmap__chart-col">
                            <div className="epics-roadmap__sprint-backgrounds">
                              {roadmapData.timelineSprints.map((s, i) => {
                                const sLeft = roadmapData.toPercent(s.startDate);
                                const sWidth = roadmapData.toPercent(s.endDate) - sLeft;
                                return (
                                  <div
                                    key={s._id}
                                    className={`epics-roadmap__sprint-bg ${i % 2 === 0 ? 'epics-roadmap__sprint-bg--even' : ''} ${s.status === 'active' ? 'epics-roadmap__sprint-bg--active' : ''}`}
                                    style={{ left: `${sLeft}%`, width: `${sWidth}%` }}
                                  />
                                );
                              })}
                            </div>
                            {epicVisibleSprints.map(sprint => {
                              const left = roadmapData.toPercent(sprint.startDate);
                              const width = roadmapData.toPercent(sprint.endDate) - left;
                              const ss = sprintStatsMap[sprint._id?.toString()];
                              const deliveredSP = ss?.deliveredSP || 0;
                              const totalSP = ss?.totalSP || 0;
                              return (
                                <div
                                  key={sprint._id}
                                  className={`epics-roadmap__bar epics-roadmap__bar--${epic.status || 'backlog'}`}
                                  style={{
                                    left: `${left}%`,
                                    width: `${Math.max(width, 1)}%`,
                                    background: roadmapData.entityColorMap[entityName]
                                  }}
                                  title={`${epic.key} — ${epic.title}\n${sprint.name}\n${deliveredSP} SP livrés / ${totalSP} SP total`}
                                >
                                  {totalSP > 0 ? (
                                    <span className="epics-roadmap__bar-label">{deliveredSP} SP</span>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              )}

              {/* Stream de capacité équipe (cliquer pour saisir les congés) */}
              <div
                className="epics-roadmap__capacity"
                onClick={() => setShowAvailability(true)}
                title={t('availability.streamHint')}
              >
                <div className="epics-roadmap__labels-col" style={{ width: roadmapLabelWidth, flexShrink: 0 }}>
                  <span className="epics-roadmap__capacity-title">
                    <i className="bi bi-people-fill" /> {t('availability.streamLabel')}
                  </span>
                </div>
                <div className="epics-roadmap__resize-handle" style={{ pointerEvents: 'none' }} />
                <div className="epics-roadmap__chart-col">
                  {roadmapData.timelineSprints.map(s => {
                    const left = roadmapData.toPercent(s.startDate);
                    const width = roadmapData.toPercent(s.endDate) - left;
                    const cap = capacityById[s._id?.toString()];
                    const pct = cap ? cap.availabilityPercent : 100;
                    return (
                      <div
                        key={s._id}
                        className="epics-roadmap__capacity-seg"
                        style={{ left: `${left}%`, width: `${Math.max(width, 1)}%`, background: availabilityColor(pct) }}
                        title={`${s.name}\n${pct}% ${t('availability.available')}${cap ? `\n${cap.totalDaysOff} ${t('availability.daysOff')}` : ''}`}
                      >
                        <span className="epics-roadmap__capacity-val">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Tab: Billing */}
      {activeTab === 'billing' && (
        <div className="epics-billing">
          {/* Filters */}
          <Card className="epics-billing__filters-card">
            <div className="epics-billing__filters-row">
              <MultiSelectFilter
                options={sprints.map(s => {
                  const fmt = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' }) : '?';
                  return { value: s._id, label: `${s.name} · ${fmt(s.startDate)} – ${fmt(s.endDate)}` };
                })}
                value={billingFilters.sprints}
                onChange={(values) => setBillingFilters(prev => ({ ...prev, sprints: values }))}
                placeholder={t('epics.billing.selectSprints')}
              />
              <Select
                options={[
                  { value: '', label: t('epics.allEntities') },
                  ...availableEntityLabels.map(l => ({ value: l.name, label: l.name }))
                ]}
                value={billingFilters.entityLabel}
                onChange={(val) => setBillingFilters(prev => ({ ...prev, entityLabel: (val && val.target) ? val.target.value : (val ?? '') }))}
              />
            </div>
          </Card>

          {/* Selected sprints date range */}
          {billingFilters.sprints.length > 0 && (() => {
            const fmt = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' }) : '?';
            const selectedSprintObjects = billingFilters.sprints
              .map(id => sprints.find(s => s._id === id))
              .filter(Boolean)
              .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            const globalStart = selectedSprintObjects[0]?.startDate;
            const globalEnd = selectedSprintObjects[selectedSprintObjects.length - 1]?.endDate;
            return (
              <div className="epics-billing__sprint-dates">
                <div className="epics-billing__sprint-dates-pills">
                  {selectedSprintObjects.map(s => (
                    <div key={s._id} className="epics-billing__sprint-pill">
                      <span className="epics-billing__sprint-pill-name">{s.name}</span>
                      <span className="epics-billing__sprint-pill-range">
                        <i className="bi bi-calendar3"></i>
                        {fmt(s.startDate)} → {fmt(s.endDate)}
                      </span>
                    </div>
                  ))}
                </div>
                {selectedSprintObjects.length > 1 && (
                  <div className="epics-billing__sprint-dates-global">
                    <i className="bi bi-calendar-range"></i>
                    Période globale : <strong>{fmt(globalStart)}</strong> → <strong>{fmt(globalEnd)}</strong>
                  </div>
                )}
              </div>
            );
          })()}

          {billingLoading ? (
            <div className="epics-billing__loading"><Spinner size="lg" /></div>
          ) : billingFilters.sprints.length === 0 ? (
            <div className="epics-billing__empty">
              <i className="bi bi-receipt epics-billing__empty-icon"></i>
              <p>{t('epics.billing.hint')}</p>
            </div>
          ) : billingItems.length === 0 ? (
            <div className="epics-billing__empty">
              <p>{t('epics.billing.noData')}</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="epics-billing__summary">
                <Card className="epics-billing__summary-card">
                  <div className="epics-billing__summary-value">{billingSummary.totalItems}</div>
                  <div className="epics-billing__summary-label">{t('epics.billing.items')}</div>
                </Card>
                <Card className="epics-billing__summary-card">
                  <div className="epics-billing__summary-value">{billingSummary.totalSP}</div>
                  <div className="epics-billing__summary-label">{t('epics.billing.totalSP')}</div>
                </Card>
                <Card className="epics-billing__summary-card epics-billing__summary-card--success">
                  <div className="epics-billing__summary-value">{billingSummary.doneSP}</div>
                  <div className="epics-billing__summary-label">{t('epics.billing.doneSP')}</div>
                </Card>
              </div>

              {/* Export action */}
              <div className="epics-billing__actions">
                <Button variant="secondary" size="sm" onClick={copyBillingToEmail}>
                  <i className="bi bi-clipboard-check me-2"></i>
                  {t('epics.billing.copyForEmail')}
                </Button>
              </div>

              {/* Entity groups */}
              {Object.entries(billingByEntity).sort(([a], [b]) => a.localeCompare(b)).map(([entityName, data]) => {
                const totalItems = Object.values(data.epicMap).reduce((n, g) => n + g.children.length + (g.epic ? 1 : 0), 0) + data.orphans.length;
                return (
                <Card key={entityName} className="epics-billing__entity-card">
                  <div className="epics-billing__entity-header">
                    <span className="epics-billing__entity-name">{entityName}</span>
                    <div className="epics-billing__entity-stats">
                      <span className="epics-billing__entity-stat">{totalItems} {t('epics.billing.items').toLowerCase()}</span>
                      <span className="epics-billing__entity-stat epics-billing__entity-stat--done">{data.doneSP} SP {t('epics.billing.delivered')}</span>
                    </div>
                  </div>
                  <table className="epics-billing__table">
                    <thead>
                      <tr>
                        <th>{t('epics.issueType')}</th>
                        <th>{t('epics.key')}</th>
                        <th>{t('epics.titleField')}</th>
                        <th>{t('epics.status.label')}</th>
                        <th className="epics-billing__th-sp">{t('epics.storyPoints')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.epicMap).sort(([a], [b]) => a.localeCompare(b)).map(([epicKey, group]) => {
                        const epicItem = group.epic;
                        const epicTitle = epicItem?.title || group.children[0]?.parentSummary || epicKey;
                        const epicStatus = epicItem?.status;
                        return (
                          <React.Fragment key={epicKey}>
                            {/* Epic row */}
                            <tr className={`epics-billing__row epics-billing__row--epic${epicStatus ? ` epics-billing__row--${epicStatus}` : ''}`}>
                              <td>
                                <Badge variant="primary" size="sm" rounded>Epic</Badge>
                              </td>
                              <td className="epics-billing__key">
                                <a
                                  href={epicItem?.jiraUrl || `https://jiranium-corp.atlassian.net/browse/${epicItem?.key || epicKey}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="epics-table__key"
                                >{epicItem?.key || epicKey}</a>
                              </td>
                              <td className="epics-billing__title epics-billing__title--epic">{epicTitle}</td>
                              <td></td>
                              <td></td>
                            </tr>
                            {/* Children (US) rows */}
                            {group.children.map(child => (
                              <tr key={child._id} className={`epics-billing__row epics-billing__row--child epics-billing__row--${child.status || 'backlog'}`}>
                                <td>
                                  {child.issueType ? (
                                    <Badge variant="default" size="sm" rounded>{child.issueType}</Badge>
                                  ) : '—'}
                                </td>
                                <td className="epics-billing__key epics-billing__key--child">
                                  <a
                                    href={child.jiraUrl || `https://jiranium-corp.atlassian.net/browse/${child.key}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="epics-table__key"
                                  >{child.key}</a>
                                </td>
                                <td className="epics-billing__title epics-billing__title--child">{child.title}</td>
                                <td>
                                  <Badge
                                    variant={child.status === 'done' ? 'success' : child.status === 'in_progress' ? 'warning' : child.status === 'cancelled' ? 'error' : 'default'}
                                    size="sm" dot rounded
                                  >
                                    {t(`epics.status${child.status?.charAt(0).toUpperCase()}${child.status?.slice(1).replace('_', '')}`, child.status)}
                                  </Badge>
                                </td>
                                <td className="epics-billing__sp">{child.storyPoints || 0}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                      {/* Orphans (no parent epic) */}
                      {data.orphans.map(item => (
                        <tr key={item._id} className={`epics-billing__row epics-billing__row--${item.status || 'backlog'}`}>
                          <td>
                            {item.issueType ? (
                              <Badge variant="default" size="sm" rounded>{item.issueType}</Badge>
                            ) : '—'}
                          </td>
                          <td className="epics-billing__key">
                            <a
                              href={item.jiraUrl || `https://jiranium-corp.atlassian.net/browse/${item.key}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="epics-table__key"
                            >{item.key}</a>
                          </td>
                          <td className="epics-billing__title">{item.title}</td>
                          <td>
                            <Badge
                              variant={item.status === 'done' ? 'success' : item.status === 'in_progress' ? 'warning' : item.status === 'cancelled' ? 'error' : 'default'}
                              size="sm" dot rounded
                            >
                              {t(`epics.status${item.status?.charAt(0).toUpperCase()}${item.status?.slice(1).replace('_', '')}`, item.status)}
                            </Badge>
                          </td>
                          <td className="epics-billing__sp">{item.storyPoints || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="epics-billing__total-row">
                        <td colSpan={4}><strong>Total US</strong></td>
                        <td className="epics-billing__sp"><strong>
                          {Object.values(data.epicMap).reduce((s, g) => s + g.children.reduce((cs, c) => cs + (c.storyPoints || 0), 0), 0) + data.orphans.reduce((s, i) => s + (i.storyPoints || 0), 0)}
                        </strong></td>
                      </tr>
                    </tfoot>
                  </table>
                </Card>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('epics.createTitle')}
        size="lg"
      >
        <div className="epic-form">
          <div className="epic-form__row">
            <Input
              label={t('epics.key')}
              value={formData.key}
              onChange={(e) => handleFormChange('key', e.target.value)}
              placeholder="PROJ-123"
              required
            />
            <Input
              label={t('epics.storyPoints')}
              type="number"
              value={formData.storyPoints}
              onChange={(e) => handleFormChange('storyPoints', parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>
          <Input
            label={t('epics.titleField')}
            value={formData.title}
            onChange={(e) => handleFormChange('title', e.target.value)}
            required
          />
          <Input
            label={t('epics.description')}
            value={formData.description}
            onChange={(e) => handleFormChange('description', e.target.value)}
            multiline
          />
          <div className="epic-form__row">
            <Select
              label={t('epics.status.label')}
              options={STATUS_OPTIONS}
              value={formData.status}
              onChange={(value) => handleFormChange('status', value)}
            />
            <Select
              label={t('epics.category')}
              options={CATEGORY_OPTIONS}
              value={formData.category}
              onChange={(value) => handleFormChange('category', value)}
            />
          </div>
          <div className="epic-form__row">
            <Select
              label={t('epics.priority')}
              options={PRIORITY_OPTIONS}
              value={formData.priority}
              onChange={(value) => handleFormChange('priority', value)}
            />
            <Select
              label={t('epics.sprint')}
              options={sprintOptions}
              value={formData.sprint}
              onChange={(value) => handleFormChange('sprint', value)}
            />
          </div>
          {/* Entity Labels */}
          <div className="epic-form__entity-labels">
            <label className="epic-form__label">{t('epics.entityLabels')} <span className="epic-form__label-hint">({t('epics.entityLabelsHint')})</span></label>
            <div className="epic-form__entity-labels-container">
              {formData.entityLabels.map((label, idx) => (
                <Badge key={idx} variant={label.color || 'info'} size="sm" rounded gradient removable onRemove={() => handleRemoveEntityLabel(label.name)}>
                  {label.name}
                </Badge>
              ))}
              {formData.entityLabels.length < 2 && (
                <div className="epic-form__entity-label-input-wrapper">
                  <div className="epic-form__entity-label-row">
                    <Input
                      value={entityLabelInput}
                      onChange={(e) => setEntityLabelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && entityLabelInput.trim()) {
                          e.preventDefault();
                          handleAddEntityLabel(entityLabelInput);
                        }
                      }}
                      placeholder={t('epics.entityLabelPlaceholder')}
                    />
                    <div className="epic-form__color-picker">
                      {['info', 'success', 'warning', 'error', 'primary', 'default'].map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`epic-form__color-dot epic-form__color-dot--${color}${entityLabelColor === color ? ' epic-form__color-dot--active' : ''}`}
                          onClick={() => setEntityLabelColor(color)}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                  {entityLabelInput.trim() && (
                    <div className="epic-form__label-preview">
                      <Badge variant={entityLabelColor} size="sm" rounded gradient>{entityLabelInput}</Badge>
                    </div>
                  )}
                  {getEntityLabelSuggestions().length > 0 && (
                    <div className="epic-form__entity-label-suggestions">
                      {getEntityLabelSuggestions().map((suggestion, idx) => (
                        <div
                          key={idx}
                          className="epic-form__entity-label-suggestion"
                          onClick={() => handleAddEntityLabel(suggestion.name, suggestion.color)}
                        >
                          <Badge variant={suggestion.color || 'info'} size="sm" rounded gradient>{suggestion.name}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="epic-form__actions">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleCreate}>
              {t('common.create')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('epics.editTitle')}
        size="lg"
      >
        <div className="epic-form">
          <div className="epic-form__row">
            <Input
              label={t('epics.key')}
              value={formData.key}
              onChange={(e) => handleFormChange('key', e.target.value)}
              disabled
            />
            <Input
              label={t('epics.storyPoints')}
              type="number"
              value={formData.storyPoints}
              onChange={(e) => handleFormChange('storyPoints', parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>
          <Input
            label={t('epics.titleField')}
            value={formData.title}
            onChange={(e) => handleFormChange('title', e.target.value)}
            required
          />
          <Input
            label={t('epics.description')}
            value={formData.description}
            onChange={(e) => handleFormChange('description', e.target.value)}
            multiline
          />
          <div className="epic-form__row">
            <Select
              label={t('epics.status.label')}
              options={STATUS_OPTIONS}
              value={formData.status}
              onChange={(value) => handleFormChange('status', value)}
            />
            <Select
              label={t('epics.category')}
              options={CATEGORY_OPTIONS}
              value={formData.category}
              onChange={(value) => handleFormChange('category', value)}
            />
          </div>
          <div className="epic-form__row">
            <Select
              label={t('epics.priority')}
              options={PRIORITY_OPTIONS}
              value={formData.priority}
              onChange={(value) => handleFormChange('priority', value)}
            />
            <Select
              label={t('epics.sprint')}
              options={sprintOptions}
              value={formData.sprint}
              onChange={(value) => handleFormChange('sprint', value)}
            />
          </div>
          {/* Entity Labels */}
          <div className="epic-form__entity-labels">
            <label className="epic-form__label">{t('epics.entityLabels')} <span className="epic-form__label-hint">({t('epics.entityLabelsHint')})</span></label>
            <div className="epic-form__entity-labels-container">
              {formData.entityLabels.map((label, idx) => (
                <Badge key={idx} variant={label.color || 'info'} size="sm" rounded gradient removable onRemove={() => handleRemoveEntityLabel(label.name)}>
                  {label.name}
                </Badge>
              ))}
              {formData.entityLabels.length < 2 && (
                <div className="epic-form__entity-label-input-wrapper">
                  <div className="epic-form__entity-label-row">
                    <Input
                      value={entityLabelInput}
                      onChange={(e) => setEntityLabelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && entityLabelInput.trim()) {
                          e.preventDefault();
                          handleAddEntityLabel(entityLabelInput);
                        }
                      }}
                      placeholder={t('epics.entityLabelPlaceholder')}
                    />
                    <div className="epic-form__color-picker">
                      {['info', 'success', 'warning', 'error', 'primary', 'default'].map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`epic-form__color-dot epic-form__color-dot--${color}${entityLabelColor === color ? ' epic-form__color-dot--active' : ''}`}
                          onClick={() => setEntityLabelColor(color)}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                  {entityLabelInput.trim() && (
                    <div className="epic-form__label-preview">
                      <Badge variant={entityLabelColor} size="sm" rounded gradient>{entityLabelInput}</Badge>
                    </div>
                  )}
                  {getEntityLabelSuggestions().length > 0 && (
                    <div className="epic-form__entity-label-suggestions">
                      {getEntityLabelSuggestions().map((suggestion, idx) => (
                        <div
                          key={idx}
                          className="epic-form__entity-label-suggestion"
                          onClick={() => handleAddEntityLabel(suggestion.name, suggestion.color)}
                        >
                          <Badge variant={suggestion.color || 'info'} size="sm" rounded gradient>{suggestion.name}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="epic-form__actions">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleUpdate}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('epics.deleteTitle')}
      >
        <div className="epic-delete">
          <p>{t('epics.deleteConfirmMessage', { key: selectedEpic?.key })}</p>
          <div className="epic-delete__actions">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="error" onClick={handleDelete}>
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title={t('epics.importTitle')}
        size="lg"
      >
        <div className="epic-import">
          {/* Sprint selection - required */}
          <div className="epic-import__sprint-select">
            <Select
              label={t('epics.importSelectSprint')}
              options={sprints.map(s => ({ value: s._id, label: s.name }))}
              value={importOptions.sprint}
              onChange={(e) => setImportOptions({ ...importOptions, sprint: e.target.value })}
              placeholder={t('epics.importSelectSprintPlaceholder')}
            />
            {!importOptions.sprint && (
              <p className="epic-import__sprint-hint">{t('epics.importSprintRequired')}</p>
            )}
          </div>

          {/* File upload - only enabled when sprint is selected */}
          {importOptions.sprint ? (
            <>
              <FileUpload
                title={t('epics.importFileTitle')}
                description={t('epics.importFileDescription')}
                accept=".xlsx,.xls,.csv"
                fileTypeLabel="Excel/CSV"
                onFileSelect={handleFileSelect}
                loading={importLoading}
                maxSize={10 * 1024 * 1024}
              />
              <div className="epic-import__options">
                <Input
                  label={t('epics.importSheetName')}
                  value={importOptions.sheetName}
                  onChange={(e) => setImportOptions({ ...importOptions, sheetName: e.target.value })}
                  placeholder={t('epics.importSheetNamePlaceholder')}
                />
                <Input
                  label={t('epics.importHeaderRow')}
                  type="number"
                  value={importOptions.headerRow}
                  onChange={(e) => setImportOptions({ ...importOptions, headerRow: parseInt(e.target.value) || 1 })}
                  min={1}
                />
              </div>
            </>
          ) : (
            <div className="epic-import__disabled">
              <p>{t('epics.importSelectSprintFirst')}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={t('epics.previewTitle')}
        size="lg"
      >
        <div className="epic-preview">
          {importPreview && (
            <>
              <div className="epic-preview__sprint">
                <strong>{t('epics.importTargetSprint')}:</strong>{' '}
                {sprints.find(s => s._id === importOptions.sprint)?.name || '-'}
              </div>
              <div className="epic-preview__info">
                <div className="epic-preview__summary">
                  <span className="epic-preview__summary-chip">
                    <i className="bi bi-file-earmark-text" />
                    {t('epics.previewInfo', {
                      total: importPreview.totalRows,
                      valid: importPreview.importedCount ?? importPreview.preview?.length ?? 0
                    })}
                  </span>
                  <span className={`epic-preview__summary-chip epic-preview__summary-chip--sp${importPreview.spColumnDetected === false ? ' epic-preview__summary-chip--warn' : ''}`}>
                    <i className="bi bi-lightning-fill" />
                    {importPreview.spColumnDetected === false
                      ? t('epics.previewSPNotDetected')
                      : t('epics.previewTotalSP', { sp: importPreview.totalStoryPoints ?? 0 })
                    }
                  </span>
                </div>
                {importPreview.detectedColumns && (
                  <p className="epic-preview__columns">
                    {t('epics.detectedColumns')}: {importPreview.detectedColumns.join(', ')}
                  </p>
                )}
              </div>
              {importPreview.preview && importPreview.preview.length > 0 && (
                <table className="epic-preview__table">
                  <thead>
                    <tr>
                      <th>{t('epics.key')}</th>
                      <th>{t('epics.issueType')}</th>
                      <th>{t('epics.titleField')}</th>
                      <th>{t('epics.parent')}</th>
                      <th>{t('epics.status.label')}</th>
                      <th>{t('epics.storyPoints')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.preview.map((epic, index) => (
                      <tr key={index}>
                        <td>{epic.key}</td>
                        <td>{epic.issueType ? <Badge variant={epic.issueType?.toLowerCase() === 'epic' ? 'primary' : 'default'} size="sm" rounded>{epic.issueType}</Badge> : '-'}</td>
                        <td>{epic.title}</td>
                        <td>{epic.parentSummary || epic.parentKey || '-'}</td>
                        <td>{epic.status ? <Badge variant={epic.status === 'done' ? 'success' : epic.status === 'in_progress' ? 'warning' : 'default'} size="sm" dot rounded>{epic.status}</Badge> : '-'}</td>
                        <td>{epic.storyPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {importPreview.errors && importPreview.errors.length > 0 && (
                <div className="epic-preview__errors">
                  <h4>{t('epics.previewErrors')}</h4>
                  <ul>
                    {importPreview.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="epic-preview__actions">
                <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImportConfirm}
                  disabled={importLoading || !importPreview.preview?.length}
                >
                  {importLoading ? <Spinner size="small" /> : t('epics.importConfirm')}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <StatusMappingModal
        open={showStatusMappingModal}
        onClose={() => setShowStatusMappingModal(false)}
      />

      <TeamAvailabilityModal
        open={showAvailability}
        onClose={() => setShowAvailability(false)}
        teamMembers={availabilityTeam}
        onChanged={loadCapacityStream}
      />
    </div>
  );
};

export default Epics;
