import React, { useState, useMemo } from 'react';
import { Input, Checkbox, SearchBar } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import './TeamMemberSelector.css';

/**
 * Team member selection component for sprint configuration
 * Displays team members as cards with ability to select and configure availability
 */
const TeamMemberSelector = ({
  teamMembers = [],
  selectedTeam = [],
  onTeamChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  // Roles eligible for sprint team
  const DEV_ROLES = ['developpeur', 'developpeur_junior', 'developpeur_confirme', 'developpeur_senior', 'tech_lead'];

  const formatRole = (role) => {
    const roles = {
      tech_lead: 'Tech Lead',
      developpeur: 'Développeur',
      developpeur_junior: 'Dev Junior',
      developpeur_confirme: 'Dev Confirmé',
      developpeur_senior: 'Dev Senior',
    };
    return roles[role] || role;
  };

  // Filter active dev/tech lead members by search query
  const filteredMembers = useMemo(() => {
    const activeDevs = teamMembers.filter(m =>
      m.active !== false && DEV_ROLES.includes(m.role)
    );
    if (!searchQuery.trim()) return activeDevs;

    const query = searchQuery.toLowerCase();
    return activeDevs.filter(m =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(query) ||
      m.role?.toLowerCase().includes(query) ||
      m.email?.toLowerCase().includes(query)
    );
  }, [teamMembers, searchQuery]);

  const isSelected = (memberId) => selectedTeam.some(t => t.member === memberId);
  const getTeamEntry = (memberId) => selectedTeam.find(t => t.member === memberId);

  const handleToggle = (memberId) => {
    if (disabled) return;
    if (isSelected(memberId)) {
      onTeamChange(selectedTeam.filter(t => t.member !== memberId));
    } else {
      onTeamChange([...selectedTeam, { member: memberId, availability: 100, daysOff: 0 }]);
    }
  };

  const handleUpdateMember = (memberId, field, value) => {
    if (disabled) return;
    const newTeam = selectedTeam.map(t =>
      t.member === memberId ? { ...t, [field]: parseInt(value) || 0 } : t
    );
    onTeamChange(newTeam);
  };

  const getInitials = (member) =>
    `${member.firstName?.charAt(0) || ''}${member.lastName?.charAt(0) || ''}`.toUpperCase();

  const getAvatarUrl = (member) => {
    if (member.photo) return member.photo;
    return `https://ui-avatars.com/api/?name=${getInitials(member)}&background=4F46E5&color=fff&size=64`;
  };

  const selectedCount = selectedTeam.length;

  return (
    <div className={`team-selector ${disabled ? 'team-selector--disabled' : ''}`}>
      {/* Header with search and count */}
      <div className="team-selector__header">
        <div className="team-selector__search">
          <SearchBar
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={setSearchQuery}
            disabled={disabled}
          />
        </div>
        <div className="team-selector__count">
          {selectedCount} {t('sprints.members')}
        </div>
      </div>

      {/* Member card grid */}
      {filteredMembers.length === 0 ? (
        <div className="team-selector__empty">
          {searchQuery ? t('common.noResults') : t('teamMembers.noMembers')}
        </div>
      ) : (
        <div className="team-selector__grid">
          {filteredMembers.map(member => {
            const selected = isSelected(member._id);
            const entry = getTeamEntry(member._id);

            return (
              <div
                key={member._id}
                className={`team-selector__card ${selected ? 'team-selector__card--selected' : ''}`}
              >
                {/* Card header — avatar + checkbox */}
                <div className="team-selector__card-header">
                  <img
                    src={getAvatarUrl(member)}
                    alt={`${member.firstName} ${member.lastName}`}
                    className="team-selector__card-avatar"
                  />
                  <Checkbox
                    checked={selected}
                    onChange={() => handleToggle(member._id)}
                    disabled={disabled}
                  />
                </div>

                {/* Card body — name + role */}
                <div className="team-selector__card-body" onClick={() => handleToggle(member._id)}>
                  <div className="team-selector__card-name">
                    {member.firstName} {member.lastName}
                  </div>
                  <div className="team-selector__card-role">
                    {formatRole(member.role)}
                  </div>
                </div>

                {/* Card footer — availability controls (only when selected) */}
                {selected && (
                  <div className="team-selector__card-footer">
                    <div className="team-selector__control">
                      <label className="team-selector__control-label">{t('sprints.availability', 'Dispo')}</label>
                      <div className="team-selector__control-row">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={entry?.availability ?? 100}
                          onChange={(e) => handleUpdateMember(member._id, 'availability', e.target.value)}
                          disabled={disabled}
                        />
                        <span className="team-selector__control-unit">%</span>
                        <button
                          type="button"
                          className={`team-selector__quick-btn ${entry?.availability === 50 ? 'team-selector__quick-btn--active' : ''}`}
                          onClick={() => handleUpdateMember(member._id, 'availability', entry?.availability === 50 ? 100 : 50)}
                          disabled={disabled}
                          title={t('sprints.halfTime', 'Mi-temps')}
                        >
                          50%
                        </button>
                      </div>
                    </div>
                    <div className="team-selector__control">
                      <label className="team-selector__control-label">{t('sprints.daysOffShort', 'j off')}</label>
                      <div className="team-selector__control-row">
                        <Input
                          type="number"
                          min={0}
                          value={entry?.daysOff ?? 0}
                          onChange={(e) => handleUpdateMember(member._id, 'daysOff', e.target.value)}
                          disabled={disabled}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeamMemberSelector;
