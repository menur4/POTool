import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Spinner, useToast, Badge, Input, Modal } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import {
  getHolidays,
  seedHolidays,
  createHoliday,
  deleteHoliday,
} from '../services/holidayService';
import { ConfirmationModal } from '../components/ui';
import '../styles/Holidays.css';

const Holidays = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  // Data
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterCountry, setFilterCountry] = useState('');

  // Modal states
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Seed form
  const [seedYear, setSeedYear] = useState(currentYear);
  const [seedCountries, setSeedCountries] = useState({ FR: true, MA: true });

  // Add form
  const [addForm, setAddForm] = useState({
    date: '',
    name: '',
    country: 'FR',
  });

  // Load holidays
  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (filterYear) filters.year = filterYear;
      if (filterCountry) filters.country = filterCountry;

      const result = await getHolidays(filters);
      setHolidays(result.data || []);
    } catch (error) {
      showToast({ type: 'error', message: error.message || t('holidays.loadError') });
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterCountry, showToast, t]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // Seed holidays
  const handleSeed = async () => {
    setSubmitting(true);
    try {
      const countries = Object.entries(seedCountries)
        .filter(([, checked]) => checked)
        .map(([code]) => code);

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

  // Add custom holiday
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

  // Delete holiday
  const handleDelete = async () => {
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

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    });
  };

  // Country flag + badge
  const getCountryBadge = (country) => {
    const config = {
      FR: { flag: '🇫🇷', label: t('holidays.france'), variant: 'info' },
      MA: { flag: '🇲🇦', label: t('holidays.morocco'), variant: 'success' },
    };
    const c = config[country] || { flag: '', label: country, variant: 'default' };
    return (
      <Badge variant={c.variant} size="sm" rounded>
        {c.flag} {c.label}
      </Badge>
    );
  };

  // Year options
  const yearOptions = [];
  for (let y = currentYear - 2; y <= currentYear + 2; y++) {
    yearOptions.push(y);
  }

  return (
    <div className="holidays-page">
      {/* Header */}
      <div className="holidays-header">
        <div className="holidays-header__title">
          <h1>{t('holidays.title')}</h1>
          <p className="holidays-header__subtitle">{t('holidays.subtitle')}</p>
        </div>
        <div className="holidays-header__actions">
          <Button variant="secondary" onClick={() => {
            setSeedYear(filterYear || currentYear);
            setShowSeedModal(true);
          }}>
            <i className="bi bi-arrow-repeat me-2"></i>
            {t('holidays.seed')}
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <i className="bi bi-plus-lg me-2"></i>
            {t('holidays.addHoliday')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="holidays-filters">
        <select
          className="holidays-filters__select"
          value={filterYear}
          onChange={(e) => setFilterYear(parseInt(e.target.value))}
        >
          {yearOptions.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          className="holidays-filters__select"
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
        >
          <option value="">{t('holidays.allCountries')}</option>
          <option value="FR">{t('holidays.france')}</option>
          <option value="MA">{t('holidays.morocco')}</option>
        </select>
      </div>

      {/* Holidays table */}
      <Card variant="elevated" padding="md" className="holidays-list">
        {loading ? (
          <div className="holidays-list__loading">
            <Spinner size="lg" />
            <p>{t('common.loading')}</p>
          </div>
        ) : holidays.length === 0 ? (
          <div className="holidays-list__empty">
            <i className="bi bi-calendar-event"></i>
            <p>{t('holidays.noHolidays')}</p>
            <Button variant="secondary" onClick={() => setShowSeedModal(true)}>
              <i className="bi bi-arrow-repeat me-2"></i>
              {t('holidays.seed')}
            </Button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="holidays-table">
              <thead>
                <tr>
                  <th>{t('holidays.date')}</th>
                  <th>{t('holidays.name')}</th>
                  <th>{t('holidays.country')}</th>
                  <th>{t('holidays.type')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map(holiday => (
                  <tr key={holiday._id}>
                    <td className="holidays-table__date">
                      {formatDate(holiday.date)}
                    </td>
                    <td>{holiday.name}</td>
                    <td>{getCountryBadge(holiday.country)}</td>
                    <td>
                      <Badge
                        variant={holiday.isCustom ? 'warning' : 'default'}
                        size="sm" dot rounded
                      >
                        {holiday.isCustom ? t('holidays.custom') : t('holidays.official')}
                      </Badge>
                    </td>
                    <td>
                      {holiday.isCustom && (
                        <button
                          className="holidays-table__action-btn"
                          onClick={() => {
                            setSelectedHoliday(holiday);
                            setShowDeleteModal(true);
                          }}
                          title={t('common.delete')}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Seed Modal */}
      <Modal
        open={showSeedModal}
        onClose={() => setShowSeedModal(false)}
        title={t('holidays.seedTitle')}
        size="sm"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setShowSeedModal(false)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSeed} loading={submitting} disabled={submitting}>
              {t('holidays.seed')}
            </Button>
          </div>
        }
      >
        <div className="holidays-seed-form">
          <Input
            label={t('holidays.seedYear')}
            type="number"
            value={seedYear}
            onChange={(e) => setSeedYear(parseInt(e.target.value) || currentYear)}
            fullWidth
          />
          <div className="holidays-seed-form__countries">
            <label className="holidays-seed-form__checkbox">
              <input
                type="checkbox"
                checked={seedCountries.FR}
                onChange={(e) => setSeedCountries(prev => ({ ...prev, FR: e.target.checked }))}
              />
              {t('holidays.france')}
            </label>
            <label className="holidays-seed-form__checkbox">
              <input
                type="checkbox"
                checked={seedCountries.MA}
                onChange={(e) => setSeedCountries(prev => ({ ...prev, MA: e.target.checked }))}
              />
              {t('holidays.morocco')}
            </label>
          </div>
        </div>
      </Modal>

      {/* Add Holiday Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('holidays.addHoliday')}
        size="sm"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setShowAddModal(false)} disabled={submitting}>
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
        <div className="holidays-add-form">
          <Input
            label={`${t('holidays.date')} *`}
            type="date"
            value={addForm.date}
            onChange={(e) => setAddForm(prev => ({ ...prev, date: e.target.value }))}
            fullWidth
          />
          <Input
            label={`${t('holidays.name')} *`}
            value={addForm.name}
            onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Pont du 15 août"
            fullWidth
          />
          <div>
            <label className="holidays-add-form__label">{t('holidays.country')}</label>
            <select
              className="holidays-filters__select holidays-filters__select--full"
              value={addForm.country}
              onChange={(e) => setAddForm(prev => ({ ...prev, country: e.target.value }))}
            >
              <option value="FR">{t('holidays.france')}</option>
              <option value="MA">{t('holidays.morocco')}</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title={t('holidays.deleteConfirmTitle')}
        message={t('holidays.deleteConfirmMessage', { name: selectedHoliday?.name })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
      />
    </div>
  );
};

export default Holidays;
