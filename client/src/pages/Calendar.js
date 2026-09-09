import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Spinner, useToast, Badge, Input, Modal } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import { getSprints } from '../services/sprintService';
import {
  getHolidaysByDateRange,
  seedHolidays,
  createHoliday,
  deleteHoliday,
} from '../services/holidayService';
import { ConfirmationModal } from '../components/ui';
import '../styles/Calendar.css';

/* ===== Helpers ===== */

const isSameDay = (d1, d2) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const toDateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const generateCalendarWeeks = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday = 0
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const days = [];

  // Previous month padding
  for (let i = startDow - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }

  // Next month padding
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
    }
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
};

/* ===== Component ===== */

const Calendar = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const todayDate = useMemo(() => new Date(), []);

  // Navigation
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());

  // Data
  const [sprints, setSprints] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState(null);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Country visibility toggles
  const [showFR, setShowFR] = useState(false);
  const [showMA, setShowMA] = useState(true);

  // Weekend visibility toggle
  const [showWeekends, setShowWeekends] = useState(false);

  // Forms
  const [seedYear, setSeedYear] = useState(todayDate.getFullYear());
  const [seedCountries, setSeedCountries] = useState({ FR: true, MA: true });
  const [addForm, setAddForm] = useState({ date: '', name: '', country: 'FR' });

  // Calendar grid
  const weeks = useMemo(
    () => generateCalendarWeeks(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  // Stable keys for the visible date range
  const visibleStartKey = weeks[0]?.[0]?.date ? toDateKey(weeks[0][0].date) : '';
  const visibleEndKey = weeks[weeks.length - 1]?.[6]?.date
    ? toDateKey(weeks[weeks.length - 1][6].date)
    : '';

  // Fetch sprints
  const fetchSprints = useCallback(async () => {
    try {
      const res = await getSprints();
      setSprints(res.data || []);
    } catch (error) {
      console.error('Error fetching sprints:', error);
    }
  }, []);

  // Fetch holidays for the visible range
  const fetchHolidays = useCallback(async () => {
    if (!visibleStartKey || !visibleEndKey) return;
    try {
      const res = await getHolidaysByDateRange(visibleStartKey, visibleEndKey);
      setHolidays(res.data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  }, [visibleStartKey, visibleEndKey]);

  // Initial load + reload on month change
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchSprints(), fetchHolidays()]);
      setLoading(false);
    };
    load();
  }, [fetchSprints, fetchHolidays]);

  // Holiday lookup by date key (filtered by visible countries)
  const holidayMap = useMemo(() => {
    const map = {};
    holidays.forEach((h) => {
      if (h.country === 'FR' && !showFR) return;
      if (h.country === 'MA' && !showMA) return;
      const key = toDateKey(new Date(h.date));
      if (!map[key]) map[key] = [];
      map[key].push(h);
    });
    return map;
  }, [holidays, showFR, showMA]);

  // Sprint bars for a given week
  const getSprintBars = useCallback(
    (week) => {
      const colCount = showWeekends ? 7 : 5;
      const wStart = new Date(week[0].date);
      wStart.setHours(0, 0, 0, 0);
      const wEnd = new Date(week[6].date);
      wEnd.setHours(23, 59, 59, 999);

      // When hiding weekends, only show bars that overlap Mon–Fri
      const visibleEnd = showWeekends
        ? wEnd
        : (() => { const d = new Date(week[4].date); d.setHours(23, 59, 59, 999); return d; })();

      return sprints
        .filter((s) => {
          if (!s.startDate || !s.endDate) return false;
          const sStart = new Date(s.startDate);
          sStart.setHours(0, 0, 0, 0);
          const sEnd = new Date(s.endDate);
          sEnd.setHours(23, 59, 59, 999);
          return sStart <= visibleEnd && sEnd >= wStart;
        })
        .map((s) => {
          const sStart = new Date(s.startDate);
          sStart.setHours(0, 0, 0, 0);
          const sEnd = new Date(s.endDate);
          sEnd.setHours(0, 0, 0, 0);

          // Mon=1 … Sun=7
          const toDow = (d) => { const dow = d.getDay(); return dow === 0 ? 7 : dow; };

          const startCol = sStart < wStart ? 1 : Math.min(toDow(sStart), colCount);
          const endCol = sEnd > week[6].date ? colCount : Math.min(toDow(sEnd), colCount);

          return {
            sprint: s,
            startCol,
            span: endCol - startCol + 1,
            continuesBefore: sStart < wStart,
            continuesAfter: sEnd > week[6].date,
          };
        });
    },
    [sprints, showWeekends]
  );

  /* ---- Navigation ---- */
  const goToPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setViewMonth(todayDate.getMonth());
    setViewYear(todayDate.getFullYear());
  };

  /* ---- Holiday handlers ---- */
  const handleSeed = async () => {
    setSubmitting(true);
    try {
      const countries = Object.entries(seedCountries)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const result = await seedHolidays(seedYear, countries);
      showToast({
        type: 'success',
        message: t('holidays.seedSuccess', { count: result.data?.created || 0 }),
      });
      setShowSeedModal(false);
      fetchHolidays();
    } catch (error) {
      showToast({ type: 'error', message: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdd = async () => {
    setSubmitting(true);
    try {
      await createHoliday({
        ...addForm,
        year: new Date(addForm.date).getFullYear(),
        isCustom: true,
      });
      showToast({ type: 'success', message: t('holidays.createSuccess') });
      setShowAddModal(false);
      setAddForm({ date: '', name: '', country: 'FR' });
      fetchHolidays();
    } catch (error) {
      showToast({ type: 'error', message: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHoliday = async () => {
    try {
      await deleteHoliday(selectedHoliday._id);
      showToast({ type: 'success', message: t('holidays.deleteSuccess') });
      setShowDeleteModal(false);
      setSelectedHoliday(null);
      fetchHolidays();
    } catch (error) {
      showToast({ type: 'error', message: error.message });
    }
  };

  /* ---- Derived data ---- */
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  // Mon–Sun headers
  const dayHeaders = useMemo(() => {
    // Jan 1 2024 = Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2024, 0, 1 + i);
      return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    });
  }, []);

  const isWeekend = (date) => {
    const d = date.getDay();
    return d === 0 || d === 6;
  };

  /* ---- Render ---- */
  if (loading) {
    return (
      <div className="cal-page">
        <div className="cal-page__loading">
          <Spinner size="lg" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cal-page">
      {/* ===== Header ===== */}
      <div className="cal-header">
        <div className="cal-header__nav">
          <button className="cal-header__arrow" onClick={goToPrev} aria-label="Previous month">
            <i className="bi bi-chevron-left"></i>
          </button>
          <button className="cal-header__today" onClick={goToToday}>
            {t('calendar.today')}
          </button>
          <button className="cal-header__arrow" onClick={goToNext} aria-label="Next month">
            <i className="bi bi-chevron-right"></i>
          </button>
          <h1 className="cal-header__month">{monthLabel}</h1>
        </div>

        {/* Toggle buttons */}
        <div className="cal-header__filters">
          <button
            className={`cal-header__flag ${showFR ? '' : 'cal-header__flag--off'}`}
            onClick={() => setShowFR((v) => !v)}
            title={showFR ? t('calendar.hideCountry', { country: t('holidays.france') }) : t('calendar.showCountry', { country: t('holidays.france') })}
          >
            <span className="cal-header__flag-emoji">{'\u{1F1EB}\u{1F1F7}'}</span>
            <span className="cal-header__flag-label">{t('holidays.france')}</span>
          </button>
          <button
            className={`cal-header__flag ${showMA ? '' : 'cal-header__flag--off'}`}
            onClick={() => setShowMA((v) => !v)}
            title={showMA ? t('calendar.hideCountry', { country: t('holidays.morocco') }) : t('calendar.showCountry', { country: t('holidays.morocco') })}
          >
            <span className="cal-header__flag-emoji">{'\u{1F1F2}\u{1F1E6}'}</span>
            <span className="cal-header__flag-label">{t('holidays.morocco')}</span>
          </button>
          <button
            className={`cal-header__flag ${showWeekends ? '' : 'cal-header__flag--off'}`}
            onClick={() => setShowWeekends((v) => !v)}
            title={showWeekends ? t('calendar.hideWeekends') : t('calendar.showWeekends')}
          >
            <i className="bi bi-calendar2-week"></i>
            <span className="cal-header__flag-label">{t('calendar.weekends')}</span>
          </button>
        </div>

        <div className="cal-header__actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSeedYear(viewYear);
              setShowSeedModal(true);
            }}
          >
            <i className="bi bi-arrow-repeat me-2"></i>
            {t('holidays.seed')}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
            <i className="bi bi-plus-lg me-2"></i>
            {t('holidays.addHoliday')}
          </Button>
        </div>
      </div>

      {/* ===== Calendar Grid ===== */}
      <div className={`cal ${!showWeekends ? 'cal--weekdays' : ''}`}>
        {/* Day-of-week headers */}
        <div className="cal__dow-row">
          {(showWeekends ? dayHeaders : dayHeaders.slice(0, 5)).map((label, i) => (
            <div
              key={i}
              className={`cal__dow ${i >= 5 ? 'cal__dow--weekend' : ''}`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="cal__body">
          {weeks.map((week, wi) => {
            const bars = getSprintBars(week);
            const visibleDays = showWeekends ? week : week.slice(0, 5);
            return (
              <div key={wi} className="cal__week">
                {/* Day cells */}
                <div className="cal__days">
                  {visibleDays.map((day, di) => {
                    const key = toDateKey(day.date);
                    const dh = holidayMap[key] || [];
                    const today = isSameDay(day.date, todayDate);
                    const weekend = isWeekend(day.date);

                    return (
                      <div
                        key={di}
                        className={[
                          'cal__day',
                          !day.isCurrentMonth && 'cal__day--muted',
                          today && 'cal__day--today',
                          weekend && 'cal__day--weekend',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <span
                          className={`cal__day-num ${today ? 'cal__day-num--today' : ''}`}
                        >
                          {day.date.getDate()}
                        </span>

                        {/* Holidays in this day */}
                        {dh.map((h) => (
                          <div
                            key={h._id}
                            className={`cal__holiday cal__holiday--${h.country.toLowerCase()}`}
                            title={`${h.name}${h.isCustom ? ` (${t('holidays.custom')})` : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (h.isCustom) {
                                setSelectedHoliday(h);
                                setShowDeleteModal(true);
                              }
                            }}
                          >
                            <span className="cal__holiday-dot" />
                            <span className="cal__holiday-name">{h.name}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                {/* Sprint bars */}
                {bars.length > 0 && (
                  <div className="cal__bars">
                    {bars.map((bar, bi) => (
                      <div
                        key={bar.sprint._id}
                        className={[
                          'cal__bar',
                          `cal__bar--${bar.sprint.status}`,
                          bar.continuesBefore && 'cal__bar--cont-left',
                          bar.continuesAfter && 'cal__bar--cont-right',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{
                          gridColumn: `${bar.startCol} / span ${bar.span}`,
                          gridRow: bi + 1,
                        }}
                        onClick={() => setSelectedSprint(bar.sprint)}
                        title={`${bar.sprint.name} — ${new Date(bar.sprint.startDate).toLocaleDateString('fr-FR')} - ${new Date(bar.sprint.endDate).toLocaleDateString('fr-FR')}`}
                      >
                        <span className="cal__bar-name">{bar.sprint.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== Legend ===== */}
      <div className="cal-legend">
        <div className="cal-legend__item">
          <span className="cal-legend__swatch cal-legend__swatch--active" />
          {t('sprints.status.active')}
        </div>
        <div className="cal-legend__item">
          <span className="cal-legend__swatch cal-legend__swatch--draft" />
          {t('sprints.status.draft')}
        </div>
        <div className="cal-legend__item">
          <span className="cal-legend__swatch cal-legend__swatch--closed" />
          {t('sprints.status.closed')}
        </div>
        <div className="cal-legend__item">
          <span className="cal-legend__swatch cal-legend__swatch--holiday-fr" />
          {t('holidays.france')}
        </div>
        <div className="cal-legend__item">
          <span className="cal-legend__swatch cal-legend__swatch--holiday-ma" />
          {t('holidays.morocco')}
        </div>
      </div>

      {/* ===== Sprint Detail Modal ===== */}
      <Modal
        open={!!selectedSprint}
        onClose={() => setSelectedSprint(null)}
        title={selectedSprint?.name || ''}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setSelectedSprint(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        }
      >
        {selectedSprint && (
          <div className="cal-sprint-detail">
            <div className="cal-sprint-detail__row">
              <span className="cal-sprint-detail__label">{t('sprints.status.label')}</span>
              <Badge
                variant={
                  selectedSprint.status === 'active'
                    ? 'success'
                    : selectedSprint.status === 'closed'
                    ? 'info'
                    : 'default'
                }
                dot rounded size="sm"
              >
                {t(`sprints.status.${selectedSprint.status}`)}
              </Badge>
            </div>
            <div className="cal-sprint-detail__row">
              <span className="cal-sprint-detail__label">{t('sprints.dates')}</span>
              <span>
                {new Date(selectedSprint.startDate).toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}{' '}
                —{' '}
                {new Date(selectedSprint.endDate).toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            {selectedSprint.goal && (
              <div className="cal-sprint-detail__row">
                <span className="cal-sprint-detail__label">{t('sprints.goal')}</span>
                <span>{selectedSprint.goal}</span>
              </div>
            )}
            <div className="cal-sprint-detail__row">
              <span className="cal-sprint-detail__label">{t('sprints.team')}</span>
              <span>
                {selectedSprint.team?.length || 0} {t('sprints.members')}
              </span>
            </div>
            <div className="cal-sprint-detail__row">
              <span className="cal-sprint-detail__label">{t('sprints.capacity')}</span>
              <span>
                {selectedSprint.capacity?.planned?.toFixed(1) || 0} j (
                {selectedSprint.workingDays} {t('sprints.workingDays')})
              </span>
            </div>
            {selectedSprint.status === 'closed' && (
              <>
                <div className="cal-sprint-detail__row">
                  <span className="cal-sprint-detail__label">{t('sprints.velocity')}</span>
                  <span>{selectedSprint.velocity?.actual || 0} SP/j</span>
                </div>
                <div className="cal-sprint-detail__row">
                  <span className="cal-sprint-detail__label">
                    {t('sprints.closeSprint.deliveredSP')}
                  </span>
                  <span>{selectedSprint.deliveredStoryPoints || 0} SP</span>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ===== Seed Modal ===== */}
      <Modal
        open={showSeedModal}
        onClose={() => setShowSeedModal(false)}
        title={t('holidays.seedTitle')}
        size="sm"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button
              variant="ghost"
              onClick={() => setShowSeedModal(false)}
              disabled={submitting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSeed}
              loading={submitting}
              disabled={submitting}
            >
              {t('holidays.seed')}
            </Button>
          </div>
        }
      >
        <div className="cal-form">
          <Input
            label={t('holidays.seedYear')}
            type="number"
            value={seedYear}
            onChange={(e) => setSeedYear(parseInt(e.target.value) || viewYear)}
            fullWidth
          />
          <div className="cal-form__countries">
            <label className="cal-form__checkbox">
              <input
                type="checkbox"
                checked={seedCountries.FR}
                onChange={(e) =>
                  setSeedCountries((prev) => ({ ...prev, FR: e.target.checked }))
                }
              />
              {t('holidays.france')}
            </label>
            <label className="cal-form__checkbox">
              <input
                type="checkbox"
                checked={seedCountries.MA}
                onChange={(e) =>
                  setSeedCountries((prev) => ({ ...prev, MA: e.target.checked }))
                }
              />
              {t('holidays.morocco')}
            </label>
          </div>
        </div>
      </Modal>

      {/* ===== Add Holiday Modal ===== */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('holidays.addHoliday')}
        size="sm"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button
              variant="ghost"
              onClick={() => setShowAddModal(false)}
              disabled={submitting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleAdd}
              loading={submitting}
              disabled={submitting || !addForm.date || !addForm.name.trim()}
            >
              {t('common.create')}
            </Button>
          </div>
        }
      >
        <div className="cal-form">
          <Input
            label={`${t('holidays.date')} *`}
            type="date"
            value={addForm.date}
            onChange={(e) => setAddForm((prev) => ({ ...prev, date: e.target.value }))}
            fullWidth
          />
          <Input
            label={`${t('holidays.name')} *`}
            value={addForm.name}
            onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Pont du 15 ao\u00fbt"
            fullWidth
          />
          <div>
            <label className="cal-form__label">{t('holidays.country')}</label>
            <select
              className="cal-form__select"
              value={addForm.country}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, country: e.target.value }))
              }
            >
              <option value="FR">{t('holidays.france')}</option>
              <option value="MA">{t('holidays.morocco')}</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* ===== Delete Confirmation ===== */}
      <ConfirmationModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteHoliday}
        title={t('holidays.deleteConfirmTitle')}
        message={t('holidays.deleteConfirmMessage', { name: selectedHoliday?.name })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
      />
    </div>
  );
};

export default Calendar;
