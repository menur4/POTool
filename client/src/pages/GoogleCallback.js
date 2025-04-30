import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Container, Typography, CircularProgress, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

const GoogleCallback = () => {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const { handleGoogleCallback } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const processGoogleCallback = async () => {
      try {
        // Extraire le token de l'URL
        const queryParams = new URLSearchParams(location.search);
        const token = queryParams.get('token');
        const errorParam = queryParams.get('error');

        if (errorParam) {
          setError(t('auth.googleAuthFailed'));
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        if (!token) {
          setError(t('auth.tokenMissing'));
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        // Traiter le token avec la fonction du contexte d'authentification
        const success = await handleGoogleCallback(token);
        
        if (success) {
          navigate('/dashboard');
        } else {
          setError(t('auth.authenticationFailed'));
          setTimeout(() => navigate('/login'), 3000);
        }
      } catch (err) {
        console.error('Erreur lors du traitement du callback Google:', err);
        setError(t('auth.authenticationFailed'));
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    processGoogleCallback();
  }, [handleGoogleCallback, navigate, location.search, t]);

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {error ? (
          <Typography color="error" variant="h6" align="center" gutterBottom>
            {error}
          </Typography>
        ) : (
          <>
            <CircularProgress />
            <Typography variant="h6" align="center" sx={{ mt: 2 }}>
              {t('auth.processingGoogleLogin')}
            </Typography>
          </>
        )}
      </Box>
    </Container>
  );
};

export default GoogleCallback;
