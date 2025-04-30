import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // Afficher un spinner ou un message de chargement
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Rediriger vers la page de connexion si l'utilisateur n'est pas authentifié
    return <Navigate to="/login" />;
  }

  // Rendre le composant enfant dans le Layout si l'utilisateur est authentifié
  return <Layout>{children}</Layout>;
};

export default ProtectedRoute;
