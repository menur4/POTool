import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="container mt-5">
      <div className="row">
        <div className="col-12">
          <h1>{t('profile.title')}</h1>
          <p>{t('profile.subtitle')}</p>
          
          <div className="card mb-4">
            <div className="card-header">
              <h5>{t('profile.personalInfo')}</h5>
            </div>
            <div className="card-body">
              <div className="row mb-3">
                <div className="col-md-3 fw-bold">{t('auth.firstName')}:</div>
                <div className="col-md-9">{user?.firstName || ''}</div>
              </div>
              <div className="row mb-3">
                <div className="col-md-3 fw-bold">{t('auth.lastName')}:</div>
                <div className="col-md-9">{user?.lastName || ''}</div>
              </div>
              <div className="row mb-3">
                <div className="col-md-3 fw-bold">{t('auth.email')}:</div>
                <div className="col-md-9">{user?.email || ''}</div>
              </div>
              <div className="row mb-3">
                <div className="col-md-3 fw-bold">{t('profile.language')}:</div>
                <div className="col-md-9">{t(`languages.${user?.language || 'french'}`)}</div>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="card-header">
              <h5>{t('profile.security')}</h5>
            </div>
            <div className="card-body">
              <button className="btn btn-primary">
                {t('profile.changePassword')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
