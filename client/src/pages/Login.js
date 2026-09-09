import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Login as LoginForm } from '@frhamon/design-system';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

const Login = () => {
  const { t } = useTranslation();
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Gestion de la soumission du formulaire
  const handleSubmit = async ({ email, password }) => {
    setLoading(true);
    const success = await login(email, password);
    if (success) {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  // Navigation vers la page d'inscription
  const handleSignUp = () => {
    navigate('/register');
  };

  // Navigation vers la page de mot de passe oublié
  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  // Logo de l'application
  const logo = (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="56" height="56" rx="12" fill="#4F46E5" />
      <path d="M16 18H24V38H16V18Z" fill="white" />
      <path d="M28 18H40V24H28V18Z" fill="white" />
      <path d="M28 26H36V32H28V26Z" fill="white" />
      <path d="M28 34H40V38H28V34Z" fill="white" />
    </svg>
  );

  return (
    <div className="auth-page">
      <LoginForm
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        title={t('auth.login')}
        subtitle={t('auth.loginSubtitle')}
        showRememberMe={true}
        showForgotPassword={true}
        onForgotPassword={handleForgotPassword}
        showSignUp={true}
        onSignUp={handleSignUp}
        logo={logo}
      />
    </div>
  );
};

export default Login;
