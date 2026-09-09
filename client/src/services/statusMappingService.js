import axios from '../config/api';

const getAuthConfig = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export const getStatusMappings = async () => {
  const response = await axios.get('/api/status-mappings', getAuthConfig());
  return response.data;
};

export const upsertStatusMapping = async (jiraStatus, internalStatus) => {
  const response = await axios.post('/api/status-mappings', { jiraStatus, internalStatus }, getAuthConfig());
  return response.data;
};

export const deleteStatusMapping = async (id) => {
  const response = await axios.delete(`/api/status-mappings/${id}`, getAuthConfig());
  return response.data;
};

export const getKnownStatuses = async () => {
  const response = await axios.get('/api/status-mappings/known-statuses', getAuthConfig());
  return response.data;
};
