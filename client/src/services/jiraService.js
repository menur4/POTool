import axios from 'axios';

const BASE = '/api/jira';

export const getJiraConfig = () =>
  axios.get(`${BASE}/config`).then(r => r.data.config);

export const saveJiraConfig = (config) =>
  axios.post(`${BASE}/config`, config).then(r => r.data);

export const testJiraConnection = (config) =>
  axios.post(`${BASE}/test-connection`, config).then(r => r.data);

export const getJiraProjects = (credentials) =>
  axios.post(`${BASE}/projects`, credentials || {}).then(r => r.data.projects);

export const getJiraFields = (credentials) =>
  axios.post(`${BASE}/fields`, credentials || {}).then(r => r.data.fields);

export const previewJiraJql = (payload) =>
  axios.post(`${BASE}/preview-jql`, payload).then(r => r.data);

export const getJiraSprints = (payload) =>
  axios.post(`${BASE}/sprints`, payload || {}).then(r => r.data.sprints);

export const syncFromJira = () =>
  axios.post(`${BASE}/sync`).then(r => r.data);
