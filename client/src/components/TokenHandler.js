import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TokenHandler = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { handleGoogleCallback } = useAuth();

  useEffect(() => {
    const processToken = async () => {
      // Extraire le token de l'URL si présent
      const queryParams = new URLSearchParams(location.search);
      const token = queryParams.get('token');

      if (token) {
        try {
          // Traiter le token avec la fonction du contexte d'authentification
          const success = await handleGoogleCallback(token);
          
          if (success) {
            // Rediriger vers le tableau de bord et nettoyer l'URL
            navigate('/dashboard', { replace: true });
          } else {
            // En cas d'échec, rediriger vers la page de connexion
            navigate('/login', { replace: true });
          }
        } catch (error) {
          console.error('Erreur lors du traitement du token:', error);
          navigate('/login', { replace: true });
        }
      }
    };

    processToken();
  }, [location.search, handleGoogleCallback, navigate]);

  return <>{children}</>;
};

export default TokenHandler;
