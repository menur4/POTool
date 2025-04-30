import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="container mt-5">
      <div className="row">
        <div className="col-12">
          <h1>{t('dashboard.title')}</h1>
          <p>{t('dashboard.welcome', { name: user?.firstName || '' })}</p>
          <div className="alert alert-info">
            {t('dashboard.noSprints')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
