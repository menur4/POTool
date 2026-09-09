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

// Obtenir tous les sprints
export const getSprints = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.sort) params.append('sort', filters.sort);

    const queryString = params.toString();
    const url = queryString ? `/api/sprints?${queryString}` : '/api/sprints';

    const response = await axios.get(url, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la récupération des sprints' };
  }
};

// Obtenir un sprint par son ID
export const getSprint = async (id) => {
  try {
    const response = await axios.get(`/api/sprints/${id}`, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la récupération du sprint' };
  }
};

// Créer un nouveau sprint
export const createSprint = async (sprintData) => {
  try {
    const response = await axios.post('/api/sprints', sprintData, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la création du sprint' };
  }
};

// Mettre à jour un sprint
export const updateSprint = async (id, sprintData) => {
  try {
    const response = await axios.put(`/api/sprints/${id}`, sprintData, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la mise à jour du sprint' };
  }
};

// Supprimer un sprint
export const deleteSprint = async (id) => {
  try {
    const response = await axios.delete(`/api/sprints/${id}`, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la suppression du sprint' };
  }
};

// Activer un sprint
export const activateSprint = async (id) => {
  try {
    const response = await axios.post(`/api/sprints/${id}/activate`, {}, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de l\'activation du sprint' };
  }
};

// Clôturer un sprint
export const closeSprint = async (id, closeData = {}) => {
  try {
    const response = await axios.post(`/api/sprints/${id}/close`, closeData, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la clôture du sprint' };
  }
};

// Rouvrir un sprint clôturé (le remet en brouillon)
export const reopenSprint = async (id) => {
  try {
    const response = await axios.post(`/api/sprints/${id}/reopen`, {}, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la réouverture du sprint' };
  }
};

// Supprimer tous les epics d'un sprint (pour réimport)
export const clearSprintEpics = async (sprintId) => {
  try {
    const response = await axios.delete(`/api/sprints/${sprintId}/epics`, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la suppression des données du sprint' };
  }
};

// Calculer la capacité d'un sprint
export const calculateCapacity = async (sprintData) => {
  try {
    const response = await axios.post('/api/sprints/calculate-capacity', sprintData, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors du calcul de la capacité' };
  }
};

// Obtenir les SP livrés d'un sprint (epics done)
// On laisse remonter l'erreur axios brute (statut HTTP conservé) pour un
// diagnostic précis côté modale (session expirée, réseau, etc.).
export const getDeliveredStoryPoints = async (sprintId) => {
  const response = await axios.get(`/api/sprints/${sprintId}/delivered-sp`, getAuthConfig());
  return response.data;
};

// Livré à date interrogé EN DIRECT depuis Jira (API Agile) — sans réimport de la base.
export const getLiveDeliveredFromJira = async (sprintId) => {
  try {
    const response = await axios.get(`/api/sprints/${sprintId}/delivered-live`, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de l\'interrogation de Jira' };
  }
};

// Synchronise (persiste) le livré d'un sprint depuis Jira.
export const syncSprintDelivered = async (sprintId) => {
  try {
    const response = await axios.post(`/api/sprints/${sprintId}/sync-delivered`, {}, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la synchronisation du livré' };
  }
};

// Saisie manuelle du livré + capacité nette d'un sprint (backfill Excel).
export const updateSprintDelivered = async (sprintId, data) => {
  try {
    const response = await axios.patch(`/api/sprints/${sprintId}/delivered`, data, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la mise à jour du livré' };
  }
};

// Backfill : synchronise le livré de tous les sprints clos liés à Jira.
export const syncAllDelivered = async () => {
  try {
    const response = await axios.post('/api/sprints/sync-delivered-all', {}, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors du backfill du livré' };
  }
};

// Réconciliation Jira : sprints Jira vus sur les tickets vs sprints internes
export const getJiraReconciliation = async () => {
  try {
    const response = await axios.get('/api/sprints/jira-reconciliation', getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la réconciliation Jira' };
  }
};

// Créer un sprint interne depuis un sprint Jira (et lier ses tickets)
export const createSprintFromJira = async (payload) => {
  try {
    const response = await axios.post('/api/sprints/from-jira', payload, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la création du sprint depuis Jira' };
  }
};

// Générer les prochains sprints (cadence 2 semaines, vendredi -> jeudi)
export const generateNextSprints = async (payload) => {
  try {
    const response = await axios.post('/api/sprints/generate-next', payload || {}, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la génération des sprints' };
  }
};

// Lier un sprint interne existant à un sprint Jira (et lier ses tickets)
export const linkSprintToJira = async (payload) => {
  try {
    const response = await axios.post('/api/sprints/link-jira', payload, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la liaison du sprint à Jira' };
  }
};

// Obtenir l'estimation de vélocité
export const getVelocityEstimate = async (sprintsToConsider = 3) => {
  try {
    const response = await axios.get(`/api/sprints/velocity-estimate?sprintsToConsider=${sprintsToConsider}`, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la récupération de l\'estimation de vélocité' };
  }
};
