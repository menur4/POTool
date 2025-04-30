import axios from 'axios';

// Configuration de l'URL de base pour toutes les requêtes API
const api = axios.create({
  baseURL: 'http://localhost:3002',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

// Intercepteur pour ajouter le token d'authentification aux requêtes
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

export default api;
