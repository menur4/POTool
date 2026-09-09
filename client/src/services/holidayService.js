import axios from '../config/api';

// Fonction pour obtenir le token d'authentification
const getAuthConfig = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

// Obtenir les jours fériés par plage de dates
export const getHolidaysByDateRange = async (startDate, endDate, countries = 'FR,MA') => {
  try {
    const response = await axios.get(
      `/api/holidays/range?startDate=${startDate}&endDate=${endDate}&countries=${countries}`,
      getAuthConfig()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la récupération des jours fériés' };
  }
};

// Obtenir les jours fériés avec filtres
export const getHolidays = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.year) params.append('year', filters.year);
    if (filters.country) params.append('country', filters.country);

    const queryString = params.toString();
    const url = queryString ? `/api/holidays?${queryString}` : '/api/holidays';

    const response = await axios.get(url, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la récupération des jours fériés' };
  }
};

// Pré-remplir les jours fériés pour une année
export const seedHolidays = async (year, countries = ['FR', 'MA']) => {
  try {
    const response = await axios.post('/api/holidays/seed', { year, countries }, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors du pré-remplissage des jours fériés' };
  }
};

// Créer un jour férié custom
export const createHoliday = async (holidayData) => {
  try {
    const response = await axios.post('/api/holidays', holidayData, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la création du jour férié' };
  }
};

// Supprimer un jour férié custom
export const deleteHoliday = async (id) => {
  try {
    const response = await axios.delete(`/api/holidays/${id}`, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la suppression du jour férié' };
  }
};
