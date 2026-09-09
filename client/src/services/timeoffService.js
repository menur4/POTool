import axios from '../config/api';

const getAuthConfig = () => {
  const token = localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

// Liste des congés (option: from/to/member)
export const getTimeOff = async (params = {}) => {
  const search = new URLSearchParams(params).toString();
  const url = search ? `/api/timeoff?${search}` : '/api/timeoff';
  const response = await axios.get(url, getAuthConfig());
  return response.data;
};

// Créer un congé
export const createTimeOff = async (payload) => {
  const response = await axios.post('/api/timeoff', payload, getAuthConfig());
  return response.data;
};

// Modifier un congé
export const updateTimeOff = async (id, payload) => {
  const response = await axios.put(`/api/timeoff/${id}`, payload, getAuthConfig());
  return response.data;
};

// Supprimer un congé
export const deleteTimeOff = async (id) => {
  const response = await axios.delete(`/api/timeoff/${id}`, getAuthConfig());
  return response.data;
};

// Jours d'absence par membre sur une période (pré-remplissage sprint)
export const getDaysOffForRange = async (startDate, endDate) => {
  const response = await axios.get(
    `/api/timeoff/days-off?startDate=${startDate}&endDate=${endDate}`,
    getAuthConfig()
  );
  return response.data; // { success, daysOff: { memberId: nbJours } }
};

// Stream de capacité : taux de dispo par sprint
export const getCapacityStream = async () => {
  const response = await axios.get('/api/timeoff/capacity-stream', getAuthConfig());
  return response.data;
};
