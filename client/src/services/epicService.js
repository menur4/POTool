import api from '../config/api';

// Obtenir tous les epics avec filtres et pagination
export const getEpics = async (params = {}) => {
  const response = await api.get('/api/epics', { params });
  return response.data;
};

// Obtenir un epic par son ID
export const getEpic = async (id) => {
  const response = await api.get(`/api/epics/${id}`);
  return response.data;
};

// Créer un nouvel epic
export const createEpic = async (epicData) => {
  const response = await api.post('/api/epics', epicData);
  return response.data;
};

// Mettre à jour un epic
export const updateEpic = async (id, epicData) => {
  const response = await api.put(`/api/epics/${id}`, epicData);
  return response.data;
};

// Supprimer un epic
export const deleteEpic = async (id) => {
  const response = await api.delete(`/api/epics/${id}`);
  return response.data;
};

// Supprimer plusieurs epics
export const deleteEpics = async (ids) => {
  const response = await api.delete('/api/epics/bulk', { data: { ids } });
  return response.data;
};

// Prévisualiser un import Excel
export const previewImport = async (file, options = {}) => {
  const formData = new FormData();
  formData.append('file', file);

  if (options.sheetName) formData.append('sheetName', options.sheetName);
  if (options.headerRow) formData.append('headerRow', options.headerRow);
  if (options.previewRows) formData.append('previewRows', options.previewRows);
  if (options.defaultCategory) formData.append('defaultCategory', options.defaultCategory);

  const response = await api.post('/api/epics/import/preview', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

// Importer des epics depuis Excel
export const importEpics = async (file, options = {}) => {
  const formData = new FormData();
  formData.append('file', file);

  if (options.sheetName) formData.append('sheetName', options.sheetName);
  if (options.headerRow) formData.append('headerRow', options.headerRow);
  if (options.defaultCategory) formData.append('defaultCategory', options.defaultCategory);
  // skipDuplicates doit être envoyé comme string 'true' ou 'false'
  formData.append('skipDuplicates', options.skipDuplicates === true ? 'true' : 'false');
  if (options.sprint) formData.append('sprint', options.sprint);

  const response = await api.post('/api/epics/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

// Assigner un epic à un sprint
export const assignToSprint = async (epicId, sprintId) => {
  const response = await api.put(`/api/epics/${epicId}/assign-sprint`, { sprintId });
  return response.data;
};

// Obtenir les statistiques des epics
export const getStats = async (params = {}) => {
  const response = await api.get('/api/epics/stats', { params });
  return response.data;
};

// Obtenir tous les labels d'entité uniques
export const getEntityLabels = async () => {
  const response = await api.get('/api/epics/entity-labels');
  return response.data;
};

export default {
  getEpics,
  getEpic,
  createEpic,
  updateEpic,
  deleteEpic,
  deleteEpics,
  previewImport,
  importEpics,
  assignToSprint,
  getStats,
  getEntityLabels
};
