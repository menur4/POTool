import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from '../config/api';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Fonction pour récupérer un cookie par son nom
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  // Vérifier si l'utilisateur est déjà connecté au chargement de l'application
  useEffect(() => {
    // Vérifier d'abord dans localStorage
    let token = localStorage.getItem('token');
    
    // Si pas de token dans localStorage, vérifier dans les cookies
    if (!token) {
      token = getCookie('token');
      // Si token trouvé dans les cookies, le sauvegarder dans localStorage
      if (token) {
        localStorage.setItem('token', token);
      }
    }
    
    if (token) {
      fetchUserProfile(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Récupérer le profil de l'utilisateur
  const fetchUserProfile = async (token) => {
    try {
      setIsLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
      const response = await axios.get('/api/auth/me', config);
      setCurrentUser(response.data);
      setIsAuthenticated(true);
    } catch (error) {
      localStorage.removeItem('token');
      setError('Session expirée. Veuillez vous reconnecter.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction de connexion
  const login = async (email, password) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await axios.post('/api/auth/login', { email, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      setCurrentUser(user);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      setError(
        error.response?.data?.error || 
        'Une erreur est survenue lors de la connexion. Veuillez réessayer.'
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction d'inscription
  const register = async (userData) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await axios.post('/api/auth/register', userData);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      setCurrentUser(user);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      setError(
        error.response?.data?.error || 
        'Une erreur est survenue lors de l\'inscription. Veuillez réessayer.'
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction de déconnexion
  const logout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  // Fonction de récupération de mot de passe
  const forgotPassword = async (email) => {
    try {
      setIsLoading(true);
      setError('');
      await axios.post('/api/auth/forgot-password', { email });
      return true;
    } catch (error) {
      setError(
        error.response?.data?.error || 
        'Une erreur est survenue. Veuillez réessayer.'
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction de réinitialisation de mot de passe
  const resetPassword = async (token, password, confirmPassword) => {
    try {
      setIsLoading(true);
      setError('');
      await axios.post('/api/auth/reset-password', { 
        token, 
        password, 
        confirmPassword 
      });
      return true;
    } catch (error) {
      setError(
        error.response?.data?.error || 
        'Une erreur est survenue. Veuillez réessayer.'
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction de mise à jour du profil
  const updateProfile = async (userData) => {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const config = {
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
      const response = await axios.put('/api/auth/me', userData, config);
      setCurrentUser(response.data);
      return true;
    } catch (error) {
      setError(
        error.response?.data?.error || 
        'Une erreur est survenue lors de la mise à jour du profil. Veuillez réessayer.'
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction de changement de mot de passe
  const changePassword = async (currentPassword, newPassword, confirmNewPassword) => {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const config = {
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
      await axios.put('/api/auth/change-password', {
        currentPassword,
        newPassword,
        confirmNewPassword
      }, config);
      return true;
    } catch (error) {
      setError(
        error.response?.data?.error || 
        'Une erreur est survenue lors du changement de mot de passe. Veuillez réessayer.'
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour gérer le callback Google
  const handleGoogleCallback = async (token) => {
    try {
      localStorage.setItem('token', token);
      await fetchUserProfile(token);
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'authentification Google:', error);
      setError('Une erreur est survenue lors de l\'authentification Google. Veuillez réessayer.');
      return false;
    }
  };

  const value = {
    currentUser,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    changePassword,
    handleGoogleCallback
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
