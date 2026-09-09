import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Input, useToast } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import { getTimeOff, createTimeOff, updateTimeOff, deleteTimeOff } from '../../services/timeoffService';
import './TeamAvailabilityModal.css';

/**
 * Édition des congés de l'équipe : sélection d'un membre, ajout/suppression
 * de périodes d'absence. Alimente le stream de capacité et le pré-remplissage
 * des jours d'absence à la création des sprints.
 */
const TeamAvailabilityModal = ({ open, onClose, teamMembers = [], onChanged, initialMemberId = '' }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [memberId, setMemberId] = useState('');

  // À l'ouverture, présélectionne le membre demandé (double-clic) et réinitialise le formulaire
  useEffect(() => {
    if (open) {
      setMemberId(initialMemberId || '');
      setStartDate(''); setEndDate(''); setReason(''); setEditingId(null);
    }
  }, [open, initialMemberId]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null); // congé en cours d'édition

  const memberName = (m) => (m ? `${m.firstName} ${m.lastName}` : '');

  const resetForm = () => { setStartDate(''); setEndDate(''); setReason(''); setEditingId(null); };

  const load = useCallback(async () => {
    try {
      const res = await getTimeOff(memberId ? { member: memberId } : {});
      setItems(res.data || []);
    } catch (e) {
      showToast({ type: 'error', message: e.response?.data?.message || e.message });
    }
  }, [memberId, showToast]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleSubmit = async () => {
    if (!memberId || !startDate || !endDate) {
      showToast({ type: 'warning', message: t('availability.fillRequired') });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateTimeOff(editingId, { startDate, endDate, reason });
        showToast({ type: 'success', message: t('availability.updated') });
      } else {
        await createTimeOff({ member: memberId, startDate, endDate, reason });
        showToast({ type: 'success', message: t('availability.added') });
      }
      resetForm();
      await load();
      if (onChanged) onChanged();
    } catch (e) {
      showToast({ type: 'error', message: e.response?.data?.message || e.message });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setStartDate(item.startDate ? new Date(item.startDate).toISOString().slice(0, 10) : '');
    setEndDate(item.endDate ? new Date(item.endDate).toISOString().slice(0, 10) : '');
    setReason(item.reason || '');
  };

  const handleDelete = async (id) => {
    try {
      await deleteTimeOff(id);
      if (editingId === id) resetForm();
      await load();
      if (onChanged) onChanged();
    } catch (e) {
      showToast({ type: 'error', message: e.response?.data?.message || e.message });
    }
  };

  const fmt = (d) => new Date(d).toLocaleDateString();

  return (
    <Modal open={open} onClose={onClose} title={t('availability.title')} size="md">
      <div className="team-availability">
        <p className="team-availability__hint">{t('availability.hint')}</p>

        <div className="team-availability__field">
          <label className="team-availability__label">{t('availability.member')}</label>
          <select
            className="team-availability__select"
            value={memberId}
            onChange={(e) => { setMemberId(e.target.value); resetForm(); }}
          >
            <option value="">{t('availability.selectMember')}</option>
            {teamMembers.map(m => (
              <option key={m._id} value={m._id}>{memberName(m)}</option>
            ))}
          </select>
        </div>

        {memberId && (
          <>
            <div className="team-availability__row">
              <div className="team-availability__field">
                <label className="team-availability__label">{t('availability.from')}</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="team-availability__field">
                <label className="team-availability__label">{t('availability.to')}</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="team-availability__field">
              <label className="team-availability__label">{t('availability.reason')}</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('availability.reasonPlaceholder')} />
            </div>
            <div className="team-availability__add">
              {editingId && (
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  {t('common.cancel')}
                </Button>
              )}
              <Button variant="primary" size="sm" loading={saving} onClick={handleSubmit}>
                {editingId
                  ? <><i className="bi bi-check-lg" /> {t('common.save')}</>
                  : <><i className="bi bi-plus-lg" /> {t('availability.add')}</>}
              </Button>
            </div>

            <div className="team-availability__list">
              {items.length === 0 ? (
                <span className="team-availability__empty">{t('availability.none')}</span>
              ) : (
                items.map(it => (
                  <div key={it._id} className={`team-availability__item ${editingId === it._id ? 'team-availability__item--editing' : ''}`}>
                    <span className="team-availability__item-dates">
                      {fmt(it.startDate)} → {fmt(it.endDate)}
                    </span>
                    {it.reason && <span className="team-availability__item-reason">{it.reason}</span>}
                    <button
                      type="button"
                      className="team-availability__item-edit"
                      onClick={() => startEdit(it)}
                      title={t('common.edit')}
                    >
                      <i className="bi bi-pencil" />
                    </button>
                    <button
                      type="button"
                      className="team-availability__item-del"
                      onClick={() => handleDelete(it._id)}
                      title={t('common.delete')}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default TeamAvailabilityModal;
