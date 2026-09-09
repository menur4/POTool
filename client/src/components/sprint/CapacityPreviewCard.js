import React from 'react';
import { Card, ProgressBar } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import './CapacityPreviewCard.css';

/**
 * Displays a visual summary of sprint capacity calculation
 * Shows working days, gross capacity, constraints deduction, and net capacity
 *
 * @param {Object} props
 * @param {Object} props.capacity - Capacity data from API
 * @param {number} props.capacity.totalWorkingDays - Total working days in sprint
 * @param {number} props.capacity.grossCapacity - Gross capacity (man-days before constraints)
 * @param {Object} props.capacity.constraints - Constraint breakdown
 * @param {number} props.capacity.constraints.meetings - Days lost to meetings
 * @param {number} props.capacity.constraints.bugs - Days lost to bugs/incidents
 * @param {number} props.capacity.constraints.tnr - Days lost to TNR (Testing & Regression)
 * @param {number} props.capacity.constraints.total - Total constraint days
 * @param {number} props.capacity.netCapacity - Net capacity after constraints
 * @param {boolean} props.loading - Whether data is loading
 */
const CapacityPreviewCard = ({ capacity, loading = false }) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Card variant="outlined" padding="md" className="capacity-preview capacity-preview--loading">
        <div className="capacity-preview__loading-text">
          {t('common.loading')}
        </div>
      </Card>
    );
  }

  if (!capacity) {
    return (
      <Card variant="outlined" padding="md" className="capacity-preview capacity-preview--empty">
        <div className="capacity-preview__empty-text">
          {t('sprints.selectTeamAndDates')}
        </div>
      </Card>
    );
  }

  const {
    totalWorkingDays = 0,
    grossCapacity = 0,
    constraints = {},
    netCapacity = 0
  } = capacity;

  const constraintsTotal = constraints.total || 0;

  // Calculate percentage for progress bar
  const netPercentage = grossCapacity > 0 ? (netCapacity / grossCapacity) * 100 : 0;
  const constraintsPercentage = grossCapacity > 0 ? (constraintsTotal / grossCapacity) * 100 : 0;

  return (
    <Card variant="outlined" padding="md" className="capacity-preview">
      <h4 className="capacity-preview__title">{t('sprints.capacityPreview')}</h4>

      {/* Main metrics grid */}
      <div className="capacity-preview__grid">
        <div className="capacity-preview__metric">
          <span className="capacity-preview__metric-label">{t('sprints.workingDays')}</span>
          <span className="capacity-preview__metric-value">{totalWorkingDays} j</span>
        </div>

        <div className="capacity-preview__metric">
          <span className="capacity-preview__metric-label">{t('sprints.grossCapacity')}</span>
          <span className="capacity-preview__metric-value">{grossCapacity.toFixed(1)} j</span>
        </div>

        <div className="capacity-preview__metric capacity-preview__metric--warning">
          <span className="capacity-preview__metric-label">{t('sprints.constraintsTotal')}</span>
          <span className="capacity-preview__metric-value">-{constraintsTotal.toFixed(1)} j</span>
        </div>

        <div className="capacity-preview__metric capacity-preview__metric--success">
          <span className="capacity-preview__metric-label">{t('sprints.netCapacity')}</span>
          <span className="capacity-preview__metric-value">{netCapacity.toFixed(1)} j</span>
        </div>
      </div>

      {/* Visual progress bar */}
      <div className="capacity-preview__bar">
        <div className="capacity-preview__bar-labels">
          <span>{t('sprints.netCapacity')}</span>
          <span>{netPercentage.toFixed(0)}%</span>
        </div>
        <ProgressBar
          value={netPercentage}
          max={100}
          variant="success"
        />
      </div>

      {/* Constraints breakdown */}
      {(constraints.meetings > 0 || constraints.bugs > 0 || constraints.tnr > 0) && (
        <div className="capacity-preview__constraints">
          <span className="capacity-preview__constraints-title">
            {t('sprints.constraints')} ({constraintsPercentage.toFixed(0)}%)
          </span>
          <div className="capacity-preview__constraints-list">
            {constraints.meetings > 0 && (
              <span className="capacity-preview__constraint-item">
                <span className="capacity-preview__constraint-dot capacity-preview__constraint-dot--meetings" />
                {t('sprints.meetingsPercent')}: {constraints.meetings.toFixed(1)}j
              </span>
            )}
            {constraints.bugs > 0 && (
              <span className="capacity-preview__constraint-item">
                <span className="capacity-preview__constraint-dot capacity-preview__constraint-dot--bugs" />
                {t('sprints.bugsPercent')}: {constraints.bugs.toFixed(1)}j
              </span>
            )}
            {constraints.tnr > 0 && (
              <span className="capacity-preview__constraint-item">
                <span className="capacity-preview__constraint-dot capacity-preview__constraint-dot--tnr" />
                {t('sprints.tnrPercent')}: {constraints.tnr.toFixed(1)}j
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export default CapacityPreviewCard;
