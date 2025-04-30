import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleGoogleCallback } = useAuth();

  useEffect(() => {
    const processAuthentication = async () => {
      // Récupérer le token depuis les paramètres d'URL
      const params = new URLSearchParams(location.search);
      const token = params.get('token');

      if (token) {
        try {
          // Utiliser la fonction handleGoogleCallback du contexte d'authentification
          const success = await handleGoogleCallback(token);
          
          if (success) {
            // Rediriger vers le tableau de bord en cas de succès
            navigate('/dashboard');
          } else {
            // Rediriger vers la page de connexion en cas d'échec
            navigate('/login', { state: { error: 'Échec de l\'authentification. Veuillez réessayer.' } });
          }
        } catch (error) {
          console.error('Erreur lors du traitement du token:', error);
          navigate('/login', { state: { error: 'Une erreur est survenue. Veuillez réessayer.' } });
        }
      } else {
        // Rediriger vers la page de connexion si aucun token n'est présent
        navigate('/login', { state: { error: 'Aucun token d\'authentification trouvé.' } });
      }
    };

    processAuthentication();
  }, [location, navigate, handleGoogleCallback]);

  // Afficher un écran de chargement pendant le traitement
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
      <div className="text-center">
        <div className="spinner-border text-primary mb-3" role="status">
          <span className="visually-hidden">Chargement...</span>
        </div>
        <h3>Authentification en cours...</h3>
        <p>Vous allez être redirigé automatiquement.</p>
      </div>
    </div>
  );
};

export default LoginSuccess;
