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

// Obtenir tous les membres de l'équipe
export const getTeamMembers = async () => {
  try {
    const response = await axios.get('/api/team-members', getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la récupération des membres de l\'équipe' };
  }
};

// Obtenir un membre de l'équipe par son ID
export const getTeamMember = async (id) => {
  try {
    const response = await axios.get(`/api/team-members/${id}`, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la récupération du membre de l\'équipe' };
  }
};

// Créer un nouveau membre de l'équipe
export const createTeamMember = async (teamMemberData) => {
  try {
    console.log('createTeamMember - Données envoyées:', teamMemberData);
    console.log('createTeamMember - URL de la photo:', teamMemberData.photo);
    
    const response = await axios.post('/api/team-members', teamMemberData, getAuthConfig());
    console.log('createTeamMember - Réponse du serveur:', response.data);
    return response.data;
  } catch (error) {
    console.error('createTeamMember - Erreur:', error);
    throw error.response?.data || { message: 'Erreur lors de la création du membre de l\'équipe' };
  }
};

// Mettre à jour un membre de l'équipe
export const updateTeamMember = async (id, teamMemberData) => {
  try {
    console.log('updateTeamMember - ID du membre:', id);
    console.log('updateTeamMember - Données envoyées:', teamMemberData);
    
    const response = await axios.put(`/api/team-members/${id}`, teamMemberData, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la mise à jour du membre de l\'équipe' };
  }
};

// Supprimer un membre de l'équipe
export const deleteTeamMember = async (id) => {
  try {
    const response = await axios.delete(`/api/team-members/${id}`, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la suppression du membre de l\'équipe' };
  }
};

// Upload d'une photo pour un membre de l'équipe
export const uploadPhoto = async (file, onProgressUpdate) => {
  try {
    const formData = new FormData();
    formData.append('photo', file);
    
    // Configuration pour l'upload de fichier avec authentification
    const token = localStorage.getItem('token');
    const config = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        // Gérer la progression de l'upload
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        // Appeler le callback si fourni
        if (onProgressUpdate && typeof onProgressUpdate === 'function') {
          onProgressUpdate(percentCompleted);
        }
      }
    };
    
    const response = await axios.post('/api/upload/photo', formData, config);
    
    // Assurer que l'URL de la photo est complète
    if (response.data && response.data.fileUrl) {
      // Si l'URL ne commence pas par http, on considère que c'est une URL relative
      if (!response.data.fileUrl.startsWith('http')) {
        // Construire l'URL complète en utilisant l'URL de base de l'API
        const baseUrl = axios.defaults.baseURL || window.location.origin;
        response.data.fileUrl = `${baseUrl}${response.data.fileUrl}`;
      }
    }
    
    return response;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de l\'upload de la photo' };
  }
};

// Activer/désactiver un membre de l'équipe
export const toggleTeamMemberStatus = async (id) => {
  try {
    const response = await axios.patch(`/api/team-members/${id}/toggle-status`, {}, getAuthConfig());
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Erreur lors de la modification du statut du membre de l\'équipe' };
  }
};
