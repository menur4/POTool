import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ConfirmationModal } from './ui';
import '../styles/Navbar.css';

const LANGUAGES = [
  { code: 'fr', flag: '🇫🇷', label: 'FR' },
  { code: 'en', flag: '🇬🇧', label: 'EN' },
  { code: 'ar', flag: '🇲🇦', label: 'AR' },
];

/**
 * Menu latéral gauche, repliable/dépliable.
 * @param {boolean} collapsed - état replié
 * @param {Function} onToggle - bascule replié/déplié
 */
const MainNavbar = ({ collapsed = false, onToggle }) => {
  const { t, i18n } = useTranslation();
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    navigate('/login');
  };

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  };

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { path: '/dashboard', icon: 'bi-speedometer2', label: t('nav.dashboard', 'Accueil') },
    { path: '/epics', icon: 'bi-list-task', label: t('nav.epics', 'Référentiel') },
    { path: '/roadmap', icon: 'bi-bar-chart-steps', label: t('nav.roadmap', 'Roadmap') },
    { path: '/calendar', icon: 'bi-calendar-event', label: t('nav.calendar', 'Calendrier') },
  ];

  const footerLinks = [
    { path: '/configuration', icon: 'bi-gear', label: t('nav.configuration', 'Configuration') },
  ];

  return (
    <>
    <aside className={`app-sidebar ${collapsed ? 'app-sidebar--collapsed' : ''}`}>
      <div className="app-sidebar__top">
        <Link to="/dashboard" className="app-sidebar__brand" title="POTool">
          <i className="bi bi-kanban app-sidebar__brand-icon"></i>
          <span className="app-sidebar__label">POTool</span>
        </Link>
        <button
          className="app-sidebar__toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
        >
          <i className={`bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
        </button>
      </div>

      <nav className="app-sidebar__links">
        {navLinks.map(({ path, icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`app-sidebar__link ${isActive(path) ? 'app-sidebar__link--active' : ''}`}
            title={label}
          >
            <i className={`bi ${icon} app-sidebar__link-icon`}></i>
            <span className="app-sidebar__label">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="app-sidebar__footer">
        <Link
          to="/profile"
          className={`app-sidebar__user ${isActive('/profile') ? 'app-sidebar__user--active' : ''}`}
          title={`${currentUser?.firstName || ''} ${currentUser?.lastName || ''} — ${t('nav.profile', 'Profil')}`}
        >
          {currentUser?.photo ? (
            <img src={currentUser.photo} alt="" className="app-sidebar__user-avatar" />
          ) : (
            <i className="bi bi-person-circle app-sidebar__user-icon"></i>
          )}
          <span className="app-sidebar__label app-sidebar__user-name">
            {currentUser?.firstName} {currentUser?.lastName}
          </span>
        </Link>

        {footerLinks.map(({ path, icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`app-sidebar__link ${isActive(path) ? 'app-sidebar__link--active' : ''}`}
            title={label}
          >
            <i className={`bi ${icon} app-sidebar__link-icon`}></i>
            <span className="app-sidebar__label">{label}</span>
          </Link>
        ))}

        <div className="app-sidebar__lang">
          {LANGUAGES.map(({ code, flag, label }) => (
            <button
              key={code}
              className={`app-sidebar__lang-btn ${i18n.language === code ? 'app-sidebar__lang-btn--active' : ''}`}
              onClick={() => handleLanguageChange(code)}
              title={label}
            >
              <span className="app-sidebar__lang-flag">{flag}</span>
              <span className="app-sidebar__label">{label}</span>
            </button>
          ))}
        </div>

        <button className="app-sidebar__link app-sidebar__logout" onClick={() => setShowLogoutConfirm(true)} title={t('nav.logout', 'Déconnexion')}>
          <i className="bi bi-box-arrow-right app-sidebar__link-icon"></i>
          <span className="app-sidebar__label">{t('nav.logout', 'Déconnexion')}</span>
        </button>
      </div>
    </aside>

    <ConfirmationModal
      open={showLogoutConfirm}
      onClose={() => setShowLogoutConfirm(false)}
      onConfirm={confirmLogout}
      title={t('nav.logout', 'Déconnexion')}
      message={t('nav.logoutConfirm', 'Voulez-vous vraiment vous déconnecter ?')}
      confirmText={t('nav.logout', 'Déconnexion')}
      cancelText={t('common.cancel', 'Annuler')}
      variant="warning"
    />
    </>
  );
};

export default MainNavbar;
