import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@frhamon/design-system';
import '../styles/NotFound.css';

const NotFound = () => {
  const { t } = useTranslation();

  return (
    <div className="not-found-page">
      <div className="not-found-page__content">
        <h1 className="not-found-page__code">404</h1>
        <h2 className="not-found-page__title">{t('errors.pageNotFound')}</h2>
        <p className="not-found-page__message">{t('errors.pageNotFoundMessage')}</p>
        <Link to="/">
          <Button variant="primary" size="lg">
            {t('errors.backToHome')}
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
