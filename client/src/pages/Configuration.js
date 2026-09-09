import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs } from '../components/ui';
import JiraConfigModal from '../components/ui/JiraConfigModal';
import TeamMembers from './TeamMembers';
import '../styles/Configuration.css';

/**
 * Page de configuration de l'application. Regroupe les réglages transverses.
 * Onglet « Équipe » aujourd'hui ; destinée à accueillir la configuration Jira
 * (rapatriée depuis le Référentiel) et d'autres réglages plus tard.
 */
const Configuration = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('team');

  const tabs = [
    { id: 'team', label: t('config.team', 'Équipe') },
    { id: 'jira', label: t('config.jira', 'Jira') },
  ];

  return (
    <div className="config-page">
      <div className="config-header">
        <h1 className="config-header__title">
          <i className="bi bi-gear" style={{ marginRight: '8px' }} />
          {t('config.title', 'Configuration')}
        </h1>
        <p className="config-header__subtitle">
          {t('config.subtitle', 'Gérez l\'équipe et les réglages de l\'application.')}
        </p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} variant="underline" />

      <div className="config-content">
        {activeTab === 'team' && <TeamMembers embedded />}
        {activeTab === 'jira' && <JiraConfigModal embedded />}
      </div>
    </div>
  );
};

export default Configuration;
